"""Préchauffage d'un serveur neuf, avant sa première requête (production).

Un conteneur Modal qui démarre doit ouvrir la connexion à Firestore et charger la banque
(plusieurs centaines de documents). Fait en tâche de fond dès le démarrage, ce travail ne
retarde plus le premier joueur : sa requête trouve tout prêt.
"""

from __future__ import annotations

import logging
import threading
import time

log = logging.getLogger("vif.warmup")


def warm_up() -> None:
    from .clock import today
    from .firebase import app, db
    from .services import bank, quiz

    started = time.monotonic()
    try:
        app()
        client = db()
        bank.all_questions(client)
        quiz.question_ids(client, today())
        log.warning("[vif] serveur prêt en %.1f s", time.monotonic() - started)
    except Exception:  # un échec ici n'est pas grave : la première requête refera le travail
        log.exception("[vif] préchauffage incomplet")


def warm_up_in_background() -> None:
    threading.Thread(target=warm_up, name="vif-warmup", daemon=True).start()
