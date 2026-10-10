"""Espace fondateur : planning des quiz, statistiques, photos."""

from __future__ import annotations

import base64
import random
import re
import uuid
from collections import Counter
from datetime import date, timedelta

from . import questions as bank
from .catalog import THINKING_PILLARS, pillar_of
from .daily import DIFFICULTY_QUOTAS, MAX_PER_CATEGORY, MIN_CATEGORIES, MIN_NUMERIC, MIN_THINKING, QUIZ_SIZE
from .scoring import round_half_up
from .service import ApiError, compute_day, now_iso, planned_days

MAX_MEDIA_BYTES = 900_000


# --- Planning -----------------------------------------------------------------

def _days(start: str, count: int) -> list[str]:
    first = date.fromisoformat(start)
    return [(first + timedelta(days=i)).isoformat() for i in range(count)]


def summarize(q: dict) -> dict:
    """Version courte d'une question pour les badges du planning."""
    return {
        "id": q["id"],
        "prompt": q["prompt"],
        "type": q["type"],
        "category": q["category"],
        "difficulty": q.get("difficulty", 2),
        "status": q.get("status", "published"),
        "image": (bank.images_of(q) or [{}])[0].get("url"),
        **bank.describe(q),
    }


def day_warnings(ids: list[str], qs: dict[str, dict], duplicates: set[str]) -> list[str]:
    """Écarts aux règles de composition (indicatifs : l'admin garde la main)."""
    items = [qs[i] for i in ids if i in qs]
    warnings = []
    if len(set(ids)) != QUIZ_SIZE:
        warnings.append("Questions en double dans la journée")
    if any(i not in qs for i in ids):
        warnings.append("Question introuvable")
    if any(q.get("status") != "published" for q in items):
        warnings.append("Question non publiée")
    if duplicates:
        warnings.append("Question aussi posée un autre jour proche")
    diff = Counter(int(q.get("difficulty", 2)) for q in items)
    if any(diff.get(level, 0) != n for level, n in DIFFICULTY_QUOTAS.items()):
        warnings.append(f"Difficulté {diff.get(1, 0)}/{diff.get(2, 0)}/{diff.get(3, 0)} au lieu de 2/4/4")
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


def is_locked(db, day: str, today: str) -> bool:
    """Un jour passé, ou aujourd'hui dès qu'un joueur a commencé, ne se modifie plus."""
    if day < today:
        return True
    if day == today:
        snap = db.collection("daily_stats").document(day).get()
        return bool(snap.exists and (snap.to_dict() or {}).get("started"))
    return False


def schedule(db, today: str, start: str, count: int) -> dict:
    qs = bank.by_id(db)
    planned = planned_days(db)
    stats = {s.id: s.to_dict() for s in db.collection("daily_stats").stream()}
    window = _days(start, count)
    out = []
    for day in window:
        ids = planned.get(day)
        neighbours = set()
        if ids:
            for other, other_ids in planned.items():
                if other != day and abs((date.fromisoformat(other) - date.fromisoformat(day)).days) <= 60:
                    neighbours |= set(other_ids)
        st = stats.get(day) or {}
        out.append({
            "date": day,
            "planned": ids is not None,
            "locked": day < today or (day == today and bool(st.get("started"))),
            "is_today": day == today,
            "players": st.get("started", 0),
            "questions": [summarize(qs[i]) if i in qs else {"id": i, "missing": True} for i in (ids or [])],
            "warnings": day_warnings(ids, qs, set(ids) & neighbours) if ids else [],
        })
    used: dict[str, list[str]] = {}
    for day, ids in planned.items():
        for qid in ids:
            used.setdefault(qid, []).append(day)
    return {"today": today, "days": out, "used": used}


def set_day(db, day: str, ids: list[str], today: str) -> None:
    if is_locked(db, day, today):
        raise ApiError(409, "Ce jour est verrouillé : des joueurs ont déjà répondu.")
    qs = bank.by_id(db)
    unknown = [i for i in ids if i not in qs]
    if unknown:
        raise ApiError(400, f"Question introuvable : {', '.join(unknown)}")
    if len(set(ids)) != QUIZ_SIZE:
        raise ApiError(400, "Une journée compte 10 questions différentes.")
    db.collection("daily_quizzes").document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": "admin"})


def regenerate_day(db, day: str, today: str) -> list[str]:
    if is_locked(db, day, today):
        raise ApiError(409, "Ce jour est verrouillé : des joueurs ont déjà répondu.")
    ids = compute_day(db, day)
    db.collection("daily_quizzes").document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": "auto"})
    return ids


def clear_day(db, day: str, today: str) -> None:
    if is_locked(db, day, today):
        raise ApiError(409, "Ce jour est verrouillé : des joueurs ont déjà répondu.")
    db.collection("daily_quizzes").document(day).delete()


def fill_schedule(db, today: str, count: int) -> list[str]:
    """Planifie automatiquement les jours vides, d'aujourd'hui à today + count."""
    planned = planned_days(db)
    created = []
    for day in _days(today, count):
        if day in planned:
            continue
        ids = compute_day(db, day, planned)
        db.collection("daily_quizzes").document(day).set({"question_ids": ids, "created_at": now_iso(), "source": "auto"})
        planned[day] = ids
        created.append(day)
    return created


# --- Statistiques -----------------------------------------------------------------

def _rate(entry: dict | None) -> dict:
    entry = entry or {}
    count = entry.get("count", 0)
    return {
        "answers": count,
        "average": round_half_up(entry.get("sum", 0) / count) if count else None,
        "success": round_half_up(100 * entry.get("correct", 0) / count) if count else None,
    }


def day_stats_view(db, day: str, raw: dict | None, qs: dict[str, dict]) -> dict:
    raw = raw or {}
    ids = planned_days(db).get(day, [])
    completed = raw.get("completed", 0)
    started = raw.get("started", 0)
    per_q = raw.get("questions", {})
    return {
        "date": day,
        "players": started,
        "completed": completed,
        "completion": round_half_up(100 * completed / started) if started else None,
        "average": round_half_up(raw.get("score_sum", 0) / completed) if completed else None,
        "distribution": [raw.get("buckets", {}).get(str(i), 0) for i in range(10)],
        "questions": [
            {**(summarize(qs[qid]) if qid in qs else {"id": qid}), "position": pos, **_rate(per_q.get(qid))}
            for pos, qid in enumerate(ids)
        ],
    }


def overview(db, today: str, days: int = 30) -> dict:
    qs = bank.by_id(db)
    daily = {s.id: s.to_dict() for s in db.collection("daily_stats").stream()}
    series = []
    for day in _days((date.fromisoformat(today) - timedelta(days=days - 1)).isoformat(), days):
        raw = daily.get(day) or {}
        completed = raw.get("completed", 0)
        series.append({
            "date": day,
            "players": raw.get("started", 0),
            "completed": completed,
            "average": round_half_up(raw.get("score_sum", 0) / completed) if completed else None,
        })

    users = db.collection("users")
    total_users = users.count().get()[0][0].value
    q_stats = {s.id: _rate(s.to_dict()) for s in db.collection("question_stats").stream()}
    rated = [
        {**summarize(qs[qid]), **rate} for qid, rate in q_stats.items()
        if qid in qs and rate["answers"] >= 3
    ]
    rated.sort(key=lambda r: (r["average"] or 0))
    planned = planned_days(db)
    ahead = 0
    for day in _days(today, 120):
        if day not in planned:
            break
        ahead += 1
    statuses = Counter(q.get("status", "published") for q in qs.values())
    reports = sum(1 for _ in db.collection("reports").stream())
    last7 = series[-7:]
    return {
        "today": day_stats_view(db, today, daily.get(today), qs),
        "series": series,
        "kpis": {
            "players_today": (daily.get(today) or {}).get("started", 0),
            "players_7d": sum(d["players"] for d in last7),
            "total_users": total_users,
            "questions_published": statuses.get("published", 0),
            "questions_draft": statuses.get("draft", 0),
            "days_planned_ahead": ahead,
            "reports": reports,
        },
        "hardest": rated[:5],
        "easiest": list(reversed(rated[-5:])),
    }


# --- Photos ---------------------------------------------------------------------

DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp|gif|svg\+xml));base64,(.+)$", re.S)


def save_media(db, data_url: str) -> str:
    match = DATA_URL.match(data_url)
    if not match:
        raise ApiError(400, "Format d'image non reconnu (PNG, JPEG, WebP, GIF ou SVG).")
    content_type, payload = match.groups()
    try:
        raw = base64.b64decode(payload, validate=True)
    except ValueError:
        raise ApiError(400, "Image illisible.") from None
    if len(raw) > MAX_MEDIA_BYTES:
        raise ApiError(413, "Image trop lourde (900 Ko maximum).")
    media_id = uuid.uuid4().hex[:16]
    db.collection("media").document(media_id).set({"content_type": content_type, "data": raw, "created_at": now_iso()})
    return f"/api/media/{media_id}"


def load_media(db, media_id: str) -> tuple[bytes, str]:
    snap = db.collection("media").document(media_id).get()
    if not snap.exists:
        raise ApiError(404, "Image introuvable.")
    data = snap.to_dict()
    return bytes(data["data"]), data["content_type"]


# --- Données de démonstration (outils de dev) ------------------------------------

def simulate_players(db, today: str, days: int = 14) -> int:
    """Remplit le tableau de bord avec des joueurs fictifs (agrégats seulement)."""
    from google.cloud import firestore

    qs = bank.by_id(db)
    rng = random.Random(f"simulate:{today}")
    total = 0
    for offset in range(days, -1, -1):
        day = (date.fromisoformat(today) - timedelta(days=offset)).isoformat()
        ids = planned_days(db).get(day) or compute_day(db, day)
        db.collection("daily_quizzes").document(day).set({"question_ids": ids, "source": "auto"}, merge=True)
        players = rng.randint(25, 90) + (days - offset) * 3
        completed = int(players * rng.uniform(0.78, 0.95))
        questions, buckets, score_sum = {}, Counter(), 0
        for qid in ids:
            q = qs[qid]
            base = {1: 0.8, 2: 0.6, 3: 0.4}[int(q.get("difficulty", 2))]
            correct = int(completed * min(0.97, max(0.05, rng.gauss(base, 0.12))))
            partial = 0 if q["type"] != "numeric" else int((completed - correct) * rng.uniform(20, 60))
            questions[qid] = {"sum": correct * 100 + partial, "count": completed, "correct": correct}
        avg = sum(v["sum"] for v in questions.values()) / (10 * completed) if completed else 0
        for _ in range(completed):
            s = max(0, min(100, int(rng.gauss(avg, 14))))
            buckets[str(min(9, s // 10))] += 1
            score_sum += s
        db.collection("daily_stats").document(day).set({
            "date": day, "started": players, "completed": completed, "score_sum": score_sum,
            "buckets": dict(buckets), "questions": questions, "simulated": True,
        })
        for qid, v in questions.items():
            db.collection("question_stats").document(qid).set(
                {"sum": firestore.Increment(v["sum"]), "count": firestore.Increment(v["count"]), "correct": firestore.Increment(v["correct"])},
                merge=True,
            )
        total += players
    return total
