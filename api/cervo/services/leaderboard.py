"""Classement du mois : `monthly_scores/{AAAA-MM}/players/{uid}`, tenu à jour à chaque quiz terminé.

Un document par joueur et par mois (pseudo, total, jours joués, dernier jour et son score) :
afficher le classement ne demande jamais de relire les parties des joueurs. La liste d'un mois
est gardée en mémoire quelques secondes (le classement est lu bien plus souvent qu'il ne change).
"""

from __future__ import annotations

import threading
import time

from google.cloud import firestore

from ..domain.leaderboard import leaderboard_view, month_of
from . import collections as col

_TTL = 30.0
_lock = threading.Lock()
_cache: dict[tuple[str, str], tuple[float, dict[str, dict]]] = {}


def _players(db, month: str):
    return db.collection(col.MONTHLY_SCORES).document(month).collection("players")


def record(batch, db, uid: str, username: str, day: str, score: int) -> None:
    """Ajoute un quiz terminé au classement du mois (dans l'écriture groupée de la réponse).

    Vider le cache (`invalidate_cache`) une fois l'écriture faite."""
    inc = firestore.Increment
    batch.set(
        _players(db, month_of(day)).document(uid),
        {"username": username, "total": inc(score), "days": inc(1), "last_day": day, "last_score": score},
        merge=True,
    )


def entries(db, month: str, force: bool = False) -> dict[str, dict]:
    key = (db.project, month)
    with _lock:
        hit = _cache.get(key)
    if hit and not force and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    data = {s.id: s.to_dict() or {} for s in _players(db, month).stream()}
    with _lock:
        _cache[key] = (time.monotonic(), data)
    return data


def view(db, uid: str, today: str) -> dict:
    return leaderboard_view(entries(db, month_of(today)), uid, today)


def rename(db, uid: str, username: str, today: str) -> None:
    """Nouveau pseudo : visible tout de suite dans le classement du mois en cours."""
    ref = _players(db, month_of(today)).document(uid)
    if ref.get().exists:
        ref.update({"username": username})
        invalidate_cache()


def rebuild_user(db, uid: str, username: str, attempts: list[dict], also: set[str] = frozenset()) -> None:
    """Recalcule les lignes du joueur depuis ses participations (outils de dev, historique fictif).

    `also` : mois à remettre d'aplomb même sans participation (quiz du jour effacé, par exemple)."""
    months: dict[str, dict] = {}
    for a in sorted(attempts, key=lambda a: a["date"]):
        if not a.get("completed_at") or a.get("score_total") is None:
            continue
        m = months.setdefault(month_of(a["date"]), {"username": username, "total": 0, "days": 0})
        m["total"] += int(a["score_total"])
        m["days"] += 1
        m["last_day"], m["last_score"] = a["date"], int(a["score_total"])
    for month in {month_of(a["date"]) for a in attempts} | set(months) | set(also):
        ref = _players(db, month).document(uid)
        if month in months:
            ref.set(months[month])
        else:
            ref.delete()
    invalidate_cache()


def delete_user(db, uid: str, months: set[str]) -> None:
    for month in months:
        _players(db, month).document(uid).delete()
    invalidate_cache()


def invalidate_cache() -> None:
    with _lock:
        _cache.clear()
