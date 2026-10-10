"""Statistiques du profil (module pur).

Les agrégats sont stockés dans `users/{uid}` et mis à jour dans la transaction
de chaque réponse ; `recompute` les reconstruit depuis les participations.
"""

from __future__ import annotations

from datetime import date, timedelta

from .catalog import CATEGORIES, PILLARS, pillar_of
from .daily import previous_day
from .scoring import round_half_up


def empty_stats() -> dict:
    return {
        "days_played": 0,
        "score_sum": 0,
        "current_streak": 0,
        "best_streak": 0,
        "last_played": None,
        "category_stats": {},
        "pillar_stats": {},
        "type_stats": {},
    }


def _bump(bucket: dict, key: str, score: int) -> None:
    entry = dict(bucket.get(key) or {"sum": 0, "count": 0, "correct": 0})
    entry["sum"] = entry.get("sum", 0) + score
    entry["count"] = entry.get("count", 0) + 1
    entry["correct"] = entry.get("correct", 0) + (1 if score >= 100 else 0)
    bucket[key] = entry


def apply_answer(stats: dict, question: dict, score: int) -> dict:
    """Ajoute une réponse aux agrégats par catégorie, pilier et type."""
    out = {**empty_stats(), **stats}
    for field, key in (
        ("category_stats", question["category"]),
        ("pillar_stats", pillar_of(question["category"])),
        ("type_stats", question["type"]),
    ):
        bucket = dict(out.get(field) or {})
        _bump(bucket, key, score)
        out[field] = bucket
    return out


def apply_completion(stats: dict, day: str, score_total: int) -> dict:
    """Met à jour jours joués, somme des scores et séries à la fin d'un quiz."""
    out = {**empty_stats(), **stats}
    last = out.get("last_played")
    if last == day:
        return out
    out["days_played"] += 1
    out["score_sum"] += score_total
    if last and last == previous_day(day):
        out["current_streak"] = out.get("current_streak", 0) + 1
    else:
        out["current_streak"] = 1
    out["best_streak"] = max(out.get("best_streak", 0), out["current_streak"])
    if not last or day > last:
        out["last_played"] = day
    return out


def displayed_streak(stats: dict, today: str) -> int:
    """La série reste visible si le dernier quiz date d'aujourd'hui ou d'hier."""
    last = stats.get("last_played")
    if last in (today, previous_day(today)):
        return int(stats.get("current_streak", 0))
    return 0


def recompute(attempts: list[dict], questions_by_id: dict[str, dict]) -> dict:
    """Reconstruit les agrégats depuis les participations (outils de dev, suppression)."""
    stats = empty_stats()
    for attempt in sorted(attempts, key=lambda a: a["date"]):
        for ans in attempt.get("answers", []):
            q = questions_by_id.get(ans["question_id"])
            if q:
                stats = apply_answer(stats, q, int(ans["score"]))
    # Les séries se calculent dans l'ordre chronologique des quiz terminés.
    for attempt in sorted(attempts, key=lambda a: a["date"]):
        if attempt.get("completed_at") is not None and attempt.get("score_total") is not None:
            stats = apply_completion(stats, attempt["date"], int(attempt["score_total"]))
    return stats


def _avg(entry: dict | None) -> int | None:
    if not entry or not entry.get("count"):
        return None
    return round_half_up(entry["sum"] / entry["count"])


def profile_summary(stats: dict, attempts: list[dict], today: str) -> dict:
    """Données du profil : en-tête, courbe 30 jours, catégories, piliers, types."""
    stats = {**empty_stats(), **stats}
    completed = sorted(
        (a for a in attempts if a.get("completed_at") is not None and a.get("score_total") is not None),
        key=lambda a: a["date"],
    )
    days_played = len(completed)
    average = round_half_up(sum(a["score_total"] for a in completed) / days_played) if days_played else None

    start = date.fromisoformat(today) - timedelta(days=29)
    by_day = {a["date"]: a["score_total"] for a in completed}
    last_30 = [
        {"date": d, "score": by_day.get(d)}
        for d in ((start + timedelta(days=i)).isoformat() for i in range(30))
    ]
    best = max(completed, key=lambda a: (a["score_total"], a["date"]), default=None)
    worst = min(completed, key=lambda a: (a["score_total"], a["date"]), default=None)

    categories = [
        {"category": key, "label": CATEGORIES.get(key, key), "average": _avg(entry), "count": entry.get("count", 0)}
        for key, entry in stats["category_stats"].items()
        if entry.get("count")
    ]
    categories.sort(key=lambda c: (-(c["average"] or 0), c["label"]))

    pillars = []
    for key, label in PILLARS.items():
        pillars.append({
            "pillar": key,
            "label": label,
            "average": _avg(stats["pillar_stats"].get(key)),
            "count": (stats["pillar_stats"].get(key) or {}).get("count", 0),
            "trend": _pillar_trend(completed, key, today),
        })

    types = stats["type_stats"]
    closed = [types.get(t) for t in ("binary", "mcq", "short_text") if types.get(t)]
    closed_count = sum(e.get("count", 0) for e in closed)
    correct_rate = (
        round_half_up(100 * sum(e.get("correct", 0) for e in closed) / closed_count) if closed_count else None
    )

    return {
        "days_played": days_played,
        "average": average,
        "current_streak": displayed_streak(stats, today),
        "best_streak": int(stats.get("best_streak", 0)),
        "last_30_days": last_30,
        "best_day": {"date": best["date"], "score": best["score_total"]} if best else None,
        "worst_day": {"date": worst["date"], "score": worst["score_total"]} if worst else None,
        "correct_rate": correct_rate,
        "numeric_precision": _avg(types.get("numeric")),
        "categories": categories,
        "pillars": pillars,
    }


def _pillar_trend(completed: list[dict], pillar: str, today: str) -> int | None:
    """Écart du score moyen du pilier entre les 7 derniers jours et les jours d'avant."""
    cutoff = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
    recent, older = [], []
    for attempt in completed:
        for ans in attempt.get("answers", []):
            if pillar_of(ans.get("category", "")) != pillar:
                continue
            (recent if attempt["date"] > cutoff else older).append(ans["score"])
    if not recent or not older:
        return None
    return round_half_up(sum(recent) / len(recent) - sum(older) / len(older))
