"""Quiz du jour : les 10 questions d'une date, dans l'ordre, identiques pour tous.

Source de vérité : `daily_quizzes/{date}`. Le document est soit écrit à l'avance depuis le
planning (admin), soit calculé automatiquement à la première visite du jour puis figé.
Le site se met donc à jour seul à minuit, même si personne n'a rien planifié.
"""

from __future__ import annotations

from datetime import date

from google.api_core.exceptions import AlreadyExists

from ..clock import now_iso
from ..domain.daily import build_daily_quiz
from . import bank
from . import collections as col

# Fenêtre d'historique prise en compte pour éviter de reposer une question.
HISTORY_DAYS = 365


def planned_days(db) -> dict[str, list[str]]:
    """Toutes les journées connues (passées et planifiées) : {date: [ids dans l'ordre]}."""
    return {d.id: list(d.to_dict().get("question_ids", [])) for d in db.collection(col.DAILY_QUIZZES).stream()}


def history_around(day: str, planned: dict[str, list[str]]) -> list[list[str]]:
    """Questions des autres journées, de la plus proche à la plus lointaine de `day`.

    On regarde aussi le futur : une question déjà planifiée dans 10 jours ne doit pas
    être reprise aujourd'hui.
    """
    target = date.fromisoformat(day)
    others = sorted((d for d in planned if d != day), key=lambda d: abs((date.fromisoformat(d) - target).days))
    return [planned[d] for d in others[:HISTORY_DAYS]]


def compute_day(db, day: str, planned: dict[str, list[str]] | None = None) -> list[str]:
    """Sélection automatique (déterministe) pour `day`, sans l'enregistrer."""
    planned = planned if planned is not None else planned_days(db)
    return build_daily_quiz(day, bank.all_questions(db), history_around(day, planned))


def question_ids(db, day: str) -> list[str]:
    """Les 10 identifiants du jour : planifiés, sinon calculés puis figés (création atomique)."""
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


def save_day(db, day: str, ids: list[str], source: str) -> None:
    db.collection(col.DAILY_QUIZZES).document(day).set({"question_ids": ids, "updated_at": now_iso(), "source": source})
