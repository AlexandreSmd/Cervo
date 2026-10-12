"""Quiz du jour : les 10 questions d'une date, dans l'ordre, identiques pour tous.

Source de vérité : `daily_quizzes/{date}`. Le document est soit écrit à l'avance depuis le
planning (admin), soit calculé automatiquement à la première visite du jour puis figé.
Le site se met donc à jour seul à minuit, même si personne n'a rien planifié.
"""

from __future__ import annotations

import threading
import time

from google.api_core.exceptions import AlreadyExists

from ..clock import now_iso
from ..domain.daily import build_daily_quiz
from . import bank
from . import collections as col

# Les 10 identifiants d'un jour sont relus à chaque requête de jeu : on les garde en mémoire
# quelques secondes (une lecture Firestore de moins par requête). Une modification faite depuis
# ce serveur vide le cache aussitôt ; depuis un autre serveur, elle est vue en moins de _TTL s.
# Sans risque en pratique : le planning d'un jour est verrouillé dès le premier joueur.
_TTL = 30.0
_lock = threading.Lock()
_ids_cache: dict[tuple[str, str], tuple[float, list[str]]] = {}


def planned_days(db) -> dict[str, list[str]]:
    """Toutes les journées connues (passées et planifiées) : {date: [ids dans l'ordre]}."""
    return {d.id: list(d.to_dict().get("question_ids", [])) for d in db.collection(col.DAILY_QUIZZES).stream()}


def compute_day(db, day: str, planned: dict[str, list[str]] | None = None) -> list[str]:
    """Sélection automatique (déterministe) pour `day`, sans l'enregistrer."""
    planned = planned if planned is not None else planned_days(db)
    return build_daily_quiz(day, bank.all_questions(db), planned)


def question_ids(db, day: str) -> list[str]:
    """Les 10 identifiants du jour : planifiés, sinon calculés puis figés (création atomique)."""
    key = (db.project, day)
    with _lock:
        hit = _ids_cache.get(key)
    if hit and time.monotonic() - hit[0] < _TTL:
        return list(hit[1])
    ids = _load_or_create(db, day)
    with _lock:
        _ids_cache[key] = (time.monotonic(), ids)
    return list(ids)


def _load_or_create(db, day: str) -> list[str]:
    ref = db.collection(col.DAILY_QUIZZES).document(day)
    snap = ref.get()
    if snap.exists:
        return list(snap.to_dict()["question_ids"])
    ids = compute_day(db, day)
    try:
        ref.create({"question_ids": ids, "created_at": now_iso(), "source": "auto"})
    except AlreadyExists:  # deux premières visites simultanées : la première gagne
        return list(ref.get().to_dict()["question_ids"])
    return ids


def invalidate_cache() -> None:
    """À appeler après toute écriture dans `daily_quizzes`."""
    with _lock:
        _ids_cache.clear()


def save_day(db, day: str, ids: list[str], source: str) -> None:
    db.collection(col.DAILY_QUIZZES).document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": source})
    invalidate_cache()


def delete_day(db, day: str) -> None:
    db.collection(col.DAILY_QUIZZES).document(day).delete()
    invalidate_cache()
