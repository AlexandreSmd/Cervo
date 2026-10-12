"""Se comparer aux autres joueurs du jour (module pur).

Calculé à partir des agrégats `daily_stats/{date}` déjà tenus à jour à chaque réponse :
aucune lecture des parties des autres joueurs. Rien n'est montré tant qu'il y a trop peu de
joueurs pour que la comparaison ait un sens.
"""

from __future__ import annotations

from .scoring import round_half_up

# En dessous, une comparaison n'apprend rien (et révélerait le score d'un ami).
MIN_PLAYERS = 3


def question_community(entry: dict | None) -> dict | None:
    """Comment les joueurs du jour s'en sont sortis sur une question (toi compris)."""
    entry = entry or {}
    count = int(entry.get("count", 0))
    if count < MIN_PLAYERS:
        return None
    return {
        "players": count,
        "success": round_half_up(100 * entry.get("correct", 0) / count),
        "average": round_half_up(entry.get("sum", 0) / count),
    }


def day_community(daily: dict | None, score_total: int) -> dict | None:
    """Ta place parmi les joueurs qui ont terminé le quiz du jour.

    `percentile` : part des AUTRES joueurs que tu dépasses, estimée par tranches de 10 points
    (les ex aequo de ta tranche comptent pour moitié).
    """
    daily = daily or {}
    completed = int(daily.get("completed", 0))
    if completed < MIN_PLAYERS:
        return None
    buckets = {int(k): int(v) for k, v in (daily.get("buckets") or {}).items()}
    mine = min(9, score_total // 10)
    below = sum(n for b, n in buckets.items() if b < mine)
    same = max(0, buckets.get(mine, 0) - 1)  # sans toi
    others = completed - 1
    return {
        "players": completed,
        "average": round_half_up(daily.get("score_sum", 0) / completed),
        "percentile": round_half_up(100 * (below + same / 2) / others) if others else None,
    }
