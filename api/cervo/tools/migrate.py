"""Passage aux 10 types de question (idempotent, lancé par `seed` à chaque déploiement).

- Les anciennes questions (hors des 10 types) sont retirées : plus jamais tirées au sort, mais
  gardées en base pour que l'historique des joueurs (résultats, profil) reste lisible.
- Idem pour les 30 premières questions des 10 types, remplacées par des versions plus difficiles.
- Les journées à venir qui contiennent encore une ancienne question sont vidées : elles seront
  recomposées automatiquement (une question de chaque type), ou depuis le planning.
  Une journée déjà commencée par des joueurs n'est jamais touchée.
"""

from __future__ import annotations

from ..clock import today
from ..domain.catalog import KINDS
from ..services import bank, quiz
from ..services import collections as col
from ..services.planning import _started

# Premières questions des 10 types (version 7), remplacées par des versions plus difficiles.
REPLACED_CONTENT = {f"{kind}-00{i}" for kind in KINDS for i in (1, 2, 3)}


def retire_legacy(db, day: str | None = None) -> tuple[int, int]:
    day = day or today()
    retired = 0
    batch = db.batch()
    for snap in db.collection(col.QUESTIONS).stream():
        q = snap.to_dict()
        outdated = q.get("category") not in KINDS or snap.id in REPLACED_CONTENT
        if outdated and q.get("status", "published") not in ("retired", "deleted"):
            batch.update(snap.reference, {"status": "retired"})
            retired += 1
    batch.commit()
    if retired:
        bank.bump_version(db)

    cleared = 0
    categories = {q["id"]: q.get("category") for q in bank.all_questions(db, force=True)}
    for snap in db.collection(col.DAILY_QUIZZES).stream():
        if snap.id < day or (snap.id == day and _started(db, day)):
            continue
        ids = snap.to_dict().get("question_ids", [])
        if any(categories.get(i) not in KINDS or i in REPLACED_CONTENT for i in ids):
            snap.reference.delete()
            cleared += 1
    quiz.invalidate_cache()
    return retired, cleared
