"""Planning (admin) : préparer, réordonner, remplacer les questions des jours à venir.

Une journée est verrouillée dès qu'elle est passée, ou dès qu'un joueur l'a commencée :
la modifier rendrait incohérentes les réponses déjà données.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from ..clock import now_iso
from ..domain.catalog import THINKING_PILLARS, pillar_of
from ..domain.daily import DIFFICULTY_QUOTAS, MAX_PER_CATEGORY, MIN_CATEGORIES, MIN_NUMERIC, MIN_THINKING, QUIZ_SIZE
from ..errors import ApiError
from . import bank, quiz
from . import collections as col

# Deux journées à moins de 60 jours d'écart ne devraient pas partager de question.
NEIGHBOUR_DAYS = 60


def date_range(start: str, count: int) -> list[str]:
    first = date.fromisoformat(start)
    return [(first + timedelta(days=i)).isoformat() for i in range(count)]


def summarize(q: dict) -> dict:
    """Question telle qu'affichée dans le planning : énoncé complet et réponse attendue."""
    cfg = q.get("numeric_config") or {}
    return {
        "id": q["id"],
        "prompt": q["prompt"],
        "type": q["type"],
        "category": q["category"],
        "difficulty": q.get("difficulty", 2),
        "status": q.get("status", "published"),
        "image": (bank.images_of(q) or [{}])[0].get("url"),
        "correct_answer": q.get("correct_answer"),
        "unit": cfg.get("unit"),
        "memorize": bool(q.get("memorize")),
        **bank.describe(q),
    }


def day_warnings(ids: list[str], qs: dict[str, dict], repeated: set[str]) -> list[str]:
    """Écarts aux règles de composition. Indicatifs : le fondateur garde la main."""
    items = [qs[i] for i in ids if i in qs]
    warnings = []
    if len(set(ids)) != QUIZ_SIZE:
        warnings.append("Questions en double dans la journée")
    if any(i not in qs for i in ids):
        warnings.append("Question introuvable")
    if any(q.get("status") != "published" for q in items):
        warnings.append("Question non publiée")
    if repeated:
        warnings.append("Question aussi posée un autre jour proche")
    diff = Counter(int(q.get("difficulty", 2)) for q in items)
    if any(diff.get(level, 0) != n for level, n in DIFFICULTY_QUOTAS.items()):
        expected = "/".join(str(DIFFICULTY_QUOTAS[k]) for k in sorted(DIFFICULTY_QUOTAS))
        warnings.append(f"Difficulté {diff.get(1, 0)}/{diff.get(2, 0)}/{diff.get(3, 0)} au lieu de {expected}")
    cats = Counter(q["category"] for q in items)
    if len(cats) < MIN_CATEGORIES or (cats and max(cats.values()) > MAX_PER_CATEGORY):
        warnings.append("Catégories peu variées")
    if sum(q["type"] == "numeric" for q in items) < MIN_NUMERIC:
        warnings.append("Moins de 2 questions « nombre »")
    if not any(bank.images_of(q) for q in items):
        warnings.append("Aucune photo")
    if sum(pillar_of(q["category"]) in THINKING_PILLARS for q in items) < MIN_THINKING:
        warnings.append("Pas assez de questions de réflexion")
    return warnings


def _started(db, day: str) -> bool:
    snap = db.collection(col.DAILY_STATS).document(day).get()
    return bool(snap.exists and (snap.to_dict() or {}).get("started"))


def ensure_editable(db, day: str, today: str) -> None:
    if day < today or (day == today and _started(db, day)):
        raise ApiError(409, "Ce jour est verrouillé : des joueurs ont déjà répondu.")


def schedule(db, today: str, start: str, count: int) -> dict:
    """Vue planning : `count` journées à partir de `start`, plus l'usage de chaque question."""
    qs = bank.by_id(db)
    planned = quiz.planned_days(db)
    stats = {s.id: s.to_dict() for s in db.collection(col.DAILY_STATS).stream()}
    days = []
    for day in date_range(start, count):
        ids = planned.get(day)
        players = (stats.get(day) or {}).get("started", 0)
        neighbours: set[str] = set()
        for other, other_ids in planned.items():
            if other != day and abs((date.fromisoformat(other) - date.fromisoformat(day)).days) <= NEIGHBOUR_DAYS:
                neighbours |= set(other_ids)
        days.append(
            {
                "date": day,
                "planned": ids is not None,
                "locked": day < today or (day == today and bool(players)),
                "is_today": day == today,
                "players": players,
                "questions": [summarize(qs[i]) if i in qs else {"id": i, "missing": True} for i in (ids or [])],
                "warnings": day_warnings(ids, qs, set(ids) & neighbours) if ids else [],
            }
        )
    return {"today": today, "days": days, "used": _usage(planned)}


def set_day(db, day: str, ids: list[str], today: str) -> None:
    ensure_editable(db, day, today)
    qs = bank.by_id(db)
    unknown = [i for i in ids if i not in qs]
    if unknown:
        raise ApiError(400, f"Question introuvable : {', '.join(unknown)}")
    if len(set(ids)) != QUIZ_SIZE:
        raise ApiError(400, "Une journée compte 10 questions différentes.")
    quiz.save_day(db, day, ids, source="admin")


def regenerate_day(db, day: str, today: str) -> list[str]:
    ensure_editable(db, day, today)
    ids = quiz.compute_day(db, day)
    quiz.save_day(db, day, ids, source="auto")
    return ids


def clear_day(db, day: str, today: str) -> None:
    ensure_editable(db, day, today)
    quiz.delete_day(db, day)


def fill(db, today: str, count: int) -> list[str]:
    """Planifie automatiquement les journées vides, d'aujourd'hui à today + count."""
    planned = quiz.planned_days(db)
    created = []
    for day in date_range(today, count):
        if day in planned:
            continue
        ids = quiz.compute_day(db, day, planned)
        db.collection(col.DAILY_QUIZZES).document(day).set({"question_ids": ids, "created_at": now_iso(), "source": "auto"})
        planned[day] = ids
        created.append(day)
    quiz.invalidate_cache()
    return created


def _usage(planned: dict[str, list[str]]) -> dict[str, list[str]]:
    used: dict[str, list[str]] = {}
    for day, ids in planned.items():
        for qid in ids:
            used.setdefault(qid, []).append(day)
    return {k: sorted(v) for k, v in used.items()}


def usage(db) -> dict[str, list[str]]:
    """Pour chaque question, les dates où elle est posée ou planifiée (triées)."""
    return _usage(quiz.planned_days(db))
