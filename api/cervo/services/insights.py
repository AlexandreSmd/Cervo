"""Statistiques du tableau de bord (admin).

Tout est lu dans des agrégats (`daily_stats`, `question_stats`) tenus à jour à chaque
réponse : le tableau de bord ne relit jamais les participations une par une.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from ..domain.catalog import DAILY_ORDER, KINDS
from ..domain.scoring import round_half_up
from . import bank, quiz
from . import collections as col
from .planning import date_range, summarize

# Une question doit avoir au moins ce nombre de réponses pour figurer dans les palmarès.
MIN_ANSWERS_FOR_RANKING = 3


def rate(entry: dict | None) -> dict:
    """Réponses, score moyen et taux de bonnes réponses d'un agrégat {sum, count, correct}."""
    entry = entry or {}
    count = entry.get("count", 0)
    return {
        "answers": count,
        "average": round_half_up(entry.get("sum", 0) / count) if count else None,
        "success": round_half_up(100 * entry.get("correct", 0) / count) if count else None,
    }


def question_rates(db) -> dict[str, dict]:
    return {s.id: rate(s.to_dict()) for s in db.collection(col.QUESTION_STATS).stream()}


def kind_overview(qs: dict[str, dict], raw_stats: dict[str, dict]) -> list[dict]:
    """Par type : questions disponibles (et donc jours de rotation), réussite et score moyen."""
    out = []
    for key in DAILY_ORDER:
        mine = [q for q in qs.values() if q.get("category") == key]
        published = [q for q in mine if q.get("status", "published") == "published"]
        total = {"sum": 0, "count": 0, "correct": 0}
        for q in mine:
            for field in total:
                total[field] += (raw_stats.get(q["id"]) or {}).get(field, 0)
        out.append(
            {
                "category": key,
                "label": KINDS[key].label,
                "emoji": KINDS[key].emoji,
                "published": len(published),
                "draft": sum(1 for q in mine if q.get("status") == "draft"),
                "levels": [sum(1 for q in published if int(q.get("difficulty", 2)) == d) for d in (1, 2, 3)],
                **rate(total),
            }
        )
    return out


def day_view(day: str, raw: dict | None, ids: list[str], qs: dict[str, dict]) -> dict:
    raw = raw or {}
    started = raw.get("started", 0)
    completed = raw.get("completed", 0)
    per_question = raw.get("questions", {})
    return {
        "date": day,
        "players": started,
        "completed": completed,
        "completion": round_half_up(100 * completed / started) if started else None,
        "average": round_half_up(raw.get("score_sum", 0) / completed) if completed else None,
        "distribution": [raw.get("buckets", {}).get(str(i), 0) for i in range(10)],
        "questions": [
            {**(summarize(qs[qid]) if qid in qs else {"id": qid}), "position": pos, **rate(per_question.get(qid))}
            for pos, qid in enumerate(ids)
        ],
    }


def day_stats(db, day: str) -> dict:
    snap = db.collection(col.DAILY_STATS).document(day).get()
    return day_view(day, snap.to_dict() if snap.exists else None, quiz.planned_days(db).get(day, []), bank.by_id(db))


def overview(db, today: str, days: int = 30) -> dict:
    qs = bank.by_id(db)
    planned = quiz.planned_days(db)
    daily = {s.id: s.to_dict() for s in db.collection(col.DAILY_STATS).stream()}

    series = []
    for day in date_range((date.fromisoformat(today) - timedelta(days=days - 1)).isoformat(), days):
        raw = daily.get(day) or {}
        completed = raw.get("completed", 0)
        series.append(
            {
                "date": day,
                "players": raw.get("started", 0),
                "completed": completed,
                "average": round_half_up(raw.get("score_sum", 0) / completed) if completed else None,
            }
        )

    raw_stats = {s.id: s.to_dict() for s in db.collection(col.QUESTION_STATS).stream()}
    rates = {qid: rate(entry) for qid, entry in raw_stats.items()}
    rated = [{**summarize(qs[qid]), **r} for qid, r in rates.items() if qid in qs and r["answers"] >= MIN_ANSWERS_FOR_RANKING]
    rated.sort(key=lambda r: r["average"] or 0)

    ahead = 0  # jours consécutifs déjà planifiés à partir d'aujourd'hui
    for day in date_range(today, 120):
        if day not in planned:
            break
        ahead += 1

    current = {k: q for k, q in qs.items() if q.get("category") in KINDS}
    statuses = Counter(q.get("status", "published") for q in current.values())
    return {
        "today": day_view(today, daily.get(today), planned.get(today, []), qs),
        "series": series,
        "kpis": {
            "players_today": (daily.get(today) or {}).get("started", 0),
            "players_7d": sum(d["players"] for d in series[-7:]),
            "total_users": db.collection(col.USERS).count().get()[0][0].value,
            "questions_published": statuses.get("published", 0),
            "questions_draft": statuses.get("draft", 0),
            "days_planned_ahead": ahead,
            "reports": sum(1 for _ in db.collection(col.REPORTS).stream()),
        },
        "hardest": rated[:5],
        "easiest": list(reversed(rated[-5:])),
        "kinds": kind_overview(current, raw_stats),
    }
