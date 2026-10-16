"""Classement du mois (module pur).

Chaque joueur cumule les scores de ses quiz terminés du mois : jouer tous les jours compte
autant que bien jouer. Ex aequo : même rang (1, 2, 2, 4).

« Avant le quiz du jour » : le même classement sans les points gagnés aujourd'hui (par tous
les joueurs). L'écart entre les deux, c'est ce que la journée a changé pour toi.
"""

from __future__ import annotations

# Lignes montrées en tête du classement (ta ligne s'ajoute si tu es plus loin).
TOP = 50


def month_of(day: str) -> str:
    """« 2026-10-16 » → « 2026-10 »."""
    return day[:7]


def _ranks(totals: dict[str, int]) -> dict[str, int]:
    """Rang de chaque joueur (classement « sportif » : les ex aequo partagent le rang)."""
    ordered = sorted(totals.items(), key=lambda kv: -kv[1])
    ranks: dict[str, int] = {}
    previous, rank = None, 0
    for index, (uid, total) in enumerate(ordered, start=1):
        if total != previous:
            rank, previous = index, total
        ranks[uid] = rank
    return ranks


def standings(entries: dict[str, dict], today: str) -> list[dict]:
    """Classement trié. `entries` : {uid: {username, total, days, last_day, last_score}}.

    Chaque ligne : uid, username, total, days, rank, previous_rank (None : pas encore classé avant
    le quiz du jour), change (places gagnées depuis, positif = mieux), played_today.
    """
    now = {uid: int(e.get("total", 0)) for uid, e in entries.items()}
    before: dict[str, int] = {}
    for uid, e in entries.items():
        today_points = int(e.get("last_score", 0)) if e.get("last_day") == today else 0
        days_before = int(e.get("days", 0)) - (1 if e.get("last_day") == today else 0)
        if days_before > 0:
            before[uid] = now[uid] - today_points
    rank_now, rank_before = _ranks(now), _ranks(before)
    rows = []
    for uid, e in entries.items():
        previous = rank_before.get(uid)
        rows.append(
            {
                "uid": uid,
                "username": e.get("username") or "Joueur",
                "total": now[uid],
                "days": int(e.get("days", 0)),
                "rank": rank_now[uid],
                "previous_rank": previous,
                "change": previous - rank_now[uid] if previous is not None else None,
                "played_today": e.get("last_day") == today,
            }
        )
    return sorted(rows, key=lambda r: (r["rank"], r["username"].lower()))


def leaderboard_view(entries: dict[str, dict], uid: str, today: str, top: int = TOP) -> dict:
    """Ce que voit le joueur : la tête du classement, et sa propre ligne (même hors du top)."""
    rows = standings(entries, today)
    me = next((r for r in rows if r["uid"] == uid), None)
    head = rows[:top]
    public = [{k: v for k, v in r.items() if k != "uid"} | {"is_me": r["uid"] == uid} for r in head]
    return {
        "month": month_of(today),
        "players": len(rows),
        "rows": public,
        "me": ({k: v for k, v in me.items() if k != "uid"} | {"is_me": True}) if me else None,
    }
