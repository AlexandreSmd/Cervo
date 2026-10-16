"""Planning (admin) : préparer et remplacer les questions des jours à venir.

Une journée = une question de chaque type, dans l'ordre du quiz (catalog.DAILY_ORDER) : le
fondateur choisit QUELLE question pour chaque type, jamais l'ordre.
Une journée est verrouillée dès qu'elle est passée, ou dès qu'un joueur l'a commencée :
la modifier rendrait incohérentes les réponses déjà données.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from ..clock import now_iso
from ..domain.catalog import DAILY_ORDER, KINDS, category_label
from ..domain.daily import published_by_kind, replacement_for
from ..errors import ApiError
from . import bank, quiz
from . import collections as col

# Une question reprise à moins de 7 jours d'écart est signalée (la banque est trop petite).
REPEAT_WARNING_DAYS = 7
# Au-delà, une journée est jugée trop facile ou trop difficile.
UNBALANCED_DAY = 6


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
        "order_details": q.get("order_details"),
        **bank.describe(q),
    }


def day_warnings(ids: list[str], qs: dict[str, dict], repeated: set[str]) -> list[str]:
    """Écarts aux règles de composition, en clair pour le fondateur."""
    items = [qs[i] for i in ids if i in qs]
    warnings = []
    if len(set(ids)) != len(ids):
        warnings.append("Question en double dans la journée")
    if any(i not in qs for i in ids):
        warnings.append("Question introuvable")
    if any(q.get("status") != "published" for q in items):
        warnings.append("Question non publiée")
    kinds = Counter(q["category"] for q in items)
    missing = [KINDS[k].label for k in DAILY_ORDER if not kinds.get(k)]
    if missing:
        warnings.append(f"Il manque : {', '.join(missing)}")
    doubled = [category_label(k) for k, n in kinds.items() if n > 1]
    if doubled:
        warnings.append(f"En double : {', '.join(doubled)}")
    if repeated:
        labels = sorted({category_label(qs[i]["category"]) for i in repeated if i in qs})
        warnings.append(f"Reprise à moins de {REPEAT_WARNING_DAYS} jours : {', '.join(labels)}")
    diff = Counter(int(q.get("difficulty", 2)) for q in items)
    if diff.get(3, 0) >= UNBALANCED_DAY:
        warnings.append(f"Journée très difficile ({diff[3]} questions difficiles)")
    if diff.get(1, 0) >= UNBALANCED_DAY:
        warnings.append(f"Journée très facile ({diff[1]} questions faciles)")
    return warnings


def kind_order(ids: list[str], qs: dict[str, dict]) -> list[str]:
    """Range les questions dans l'ordre du quiz (ordre des types)."""
    rank = {k: i for i, k in enumerate(DAILY_ORDER)}
    return sorted(ids, key=lambda i: rank.get(qs.get(i, {}).get("category"), len(rank)))


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
            if other != day and abs((date.fromisoformat(other) - date.fromisoformat(day)).days) < REPEAT_WARNING_DAYS:
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
                "difficulty": [sum(1 for i in ids or [] if int(qs.get(i, {}).get("difficulty", 0)) == d) for d in (1, 2, 3)],
            }
        )
    return {"today": today, "days": days, "used": _usage(planned)}


def set_day(db, day: str, ids: list[str], today: str) -> list[str]:
    """Enregistre une journée choisie à la main : une question par type, rangées dans l'ordre du quiz.

    Un type peut manquer (ou un autre être doublé) seulement s'il n'a aucune question publiée.
    """
    ensure_editable(db, day, today)
    qs = bank.by_id(db)
    unknown = [i for i in ids if i not in qs]
    if unknown:
        raise ApiError(400, f"Question introuvable : {', '.join(unknown)}")
    if len(set(ids)) != len(ids):
        raise ApiError(400, "La même question apparaît deux fois.")
    legacy = [i for i in ids if qs[i]["category"] not in KINDS]
    if legacy:
        raise ApiError(400, f"Ancienne question (hors des 10 types) : {', '.join(legacy)}")
    available = {k for k, pool in published_by_kind(list(qs.values())).items() if pool}
    kinds = Counter(qs[i]["category"] for i in ids)
    missing = [KINDS[k].label for k in DAILY_ORDER if k in available and not kinds.get(k)]
    if missing:
        raise ApiError(400, f"Il manque une question : {', '.join(missing)}.")
    if len(ids) != len(DAILY_ORDER):
        raise ApiError(400, "Une journée compte 10 questions.")
    ordered = kind_order(ids, qs)
    quiz.save_day(db, day, ordered, source="admin")
    return ordered


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


def delete_question(db, question_id: str, today: str) -> dict:
    """Supprime une question à jamais et la remplace partout où elle était prévue.

    - Aujourd'hui et les jours à venir : remplacée par une question du même type (la moins
      récemment posée). Aujourd'hui compris, même si des joueurs ont commencé : ceux qui y ont
      déjà répondu gardent leur réponse, les autres auront la nouvelle question.
    - Les jours passés ne bougent pas.
    - Une question déjà jouée n'est pas effacée de la base (l'historique des joueurs y renvoie) :
      elle passe au statut « deleted », invisible dans l'admin et jamais plus tirée au sort.
      Jamais jouée : elle est effacée.
    """
    qs = bank.by_id(db)
    question = qs.get(question_id)
    if not question or question.get("status") == "deleted":
        raise ApiError(404, "Question introuvable.")
    # Retirée de la banque d'abord : elle ne peut plus être choisie comme remplaçante.
    remaining = [q for q in qs.values() if q["id"] != question_id]
    planned = quiz.planned_days(db)
    replaced: dict[str, str | None] = {}
    for day in sorted(d for d, ids in planned.items() if d >= today and question_id in ids):
        ids = list(planned[day])
        new_id = replacement_for(day, question["category"], remaining, planned, set(ids) | {question_id})
        if new_id:
            ids[ids.index(question_id)] = new_id
        else:
            ids.remove(question_id)
        db.collection(col.DAILY_QUIZZES).document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": "admin"})
        planned[day] = ids
        replaced[day] = new_id

    ref = db.collection(col.QUESTIONS).document(question_id)
    played = (
        any(question_id in ids for d, ids in planned.items() if d < today)
        or db.collection(col.QUESTION_STATS).document(question_id).get().exists
    )
    if played:
        ref.update({"status": "deleted", "deleted_at": now_iso()})
    else:
        ref.delete()
    bank.bump_version(db)
    quiz.invalidate_cache()
    return {"id": question_id, "erased": not played, "replaced": replaced}


def refresh_after_ship(db, today: str) -> list[str]:
    """Nouvelles questions mises en ligne : le quiz du jour et les journées à venir composées
    automatiquement sont recomposés, pour que les nouveautés soient jouées tout de suite.

    Aujourd'hui est recomposé même si des joueurs ont commencé (choix du fondateur) : ceux qui ont
    terminé gardent leur résultat, ceux qui sont en cours finissent sur les nouvelles questions.
    Les journées à venir choisies à la main dans le planning ne bougent pas.
    """
    planned = quiz.planned_days(db)
    later = sorted(d for d, ids in planned.items() if d > today)
    sources = {s.id: (s.to_dict() or {}).get("source") for s in db.collection(col.DAILY_QUIZZES).stream() if s.id >= today}
    days = [today, *(d for d in later if sources.get(d) == "auto")]
    for day in days:
        planned.pop(day, None)
    refreshed = []
    for day in days:
        ids = quiz.compute_day(db, day, planned)
        db.collection(col.DAILY_QUIZZES).document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": "auto"})
        planned[day] = ids
        refreshed.append(day)
    quiz.invalidate_cache()
    return refreshed
