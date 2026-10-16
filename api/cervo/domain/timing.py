"""Chrono de chaque question, calculé selon son type, sa difficulté et ce qu'il y a à lire.

Principe : le chrono doit mettre la pression sur la réflexion, jamais sur la lecture. On part
d'une base par type et par difficulté (`catalog.KINDS`), puis on ajoute le temps nécessaire
pour lire l'énoncé, les choix, les éléments à classer ou à réécrire, et regarder les photos.
Le tout est multiplié par `TIME_FACTOR` (marge de confort, réglage global), puis arrondi aux
5 secondes supérieures : un chrono lisible (20, 25, 30 s…).

Un `time_limit` écrit dans la question remplace le calcul (réglage fin depuis l'admin).
"""

from __future__ import annotations

import math
import re

from .catalog import KINDS

# Marge de confort appliquée à tout le chrono calculé : les joueurs manquaient de temps à 1.
TIME_FACTOR = 1.5
# Lecture confortable sur téléphone : environ 3 mots par seconde.
WORDS_PER_SECOND = 3
# Mots « gratuits » : une question courte se lit dans le temps de base.
FREE_PROMPT_WORDS = 15
FREE_CHOICE_WORDS = 8
MAX_READING_BONUS = 20
SECONDS_PER_IMAGE = 3
# Classement : chaque élément au-delà de 4 demande de comparer davantage.
SECONDS_PER_EXTRA_ITEM = 4
# Rappel : il faut taper chaque élément.
SECONDS_PER_RECALL_ITEM = 2
# Questions d'un type inconnu (anciennes questions) : chrono historique.
LEGACY_TIME = 15

# Mémorisation : temps d'affichage par élément, plus court quand c'est difficile.
MEMORIZE_PER_ITEM = {1: 1.2, 2: 0.9, 3: 0.7}
MEMORIZE_MIN, MEMORIZE_MAX = 3, 15
MEMORIZE_IMAGES_ONLY = 5


def _words(text: str | None) -> int:
    return len(re.findall(r"\w+", text or ""))


def _round_up_5(seconds: float) -> int:
    return int(math.ceil(seconds / 5) * 5)


def time_limit(q: dict) -> int | None:
    """Chrono en secondes, ou None si la question se joue sans chrono (dictée)."""
    if q.get("time_limit"):
        return int(q["time_limit"])
    kind = KINDS.get(q.get("category", ""))
    if kind is None:
        return _round_up_5(LEGACY_TIME * TIME_FACTOR)
    if kind.base_time is None:
        return None
    difficulty = min(3, max(1, int(q.get("difficulty", 2))))
    seconds = float(kind.base_time[difficulty - 1])

    reading = max(0, _words(q.get("prompt")) - FREE_PROMPT_WORDS) / WORDS_PER_SECOND
    if q.get("type") == "mcq":
        choice_words = sum(_words(c) for c in q.get("choices") or [])
        reading += max(0, choice_words - FREE_CHOICE_WORDS) / WORDS_PER_SECOND
    seconds += min(MAX_READING_BONUS, reading)
    seconds += SECONDS_PER_IMAGE * len(q.get("images") or [])

    answer = q.get("correct_answer")
    if q.get("type") == "order" and isinstance(answer, list):
        seconds += SECONDS_PER_EXTRA_ITEM * max(0, len(answer) - 4)
    if q.get("type") == "recall" and isinstance(answer, list):
        seconds += SECONDS_PER_RECALL_ITEM * len(answer)
    return _round_up_5(seconds * TIME_FACTOR)


def memorize_seconds(q: dict) -> int | None:
    """Durée d'affichage de la phase de mémorisation (None si la question n'en a pas)."""
    memorize = q.get("memorize")
    if not memorize:
        return None
    if memorize.get("seconds"):
        return int(memorize["seconds"])
    items = memorize.get("items") or []
    if not items:
        return MEMORIZE_IMAGES_ONLY
    difficulty = min(3, max(1, int(q.get("difficulty", 2))))
    seconds = 2 + MEMORIZE_PER_ITEM[difficulty] * len(items)
    return int(min(MEMORIZE_MAX, max(MEMORIZE_MIN, round(seconds))))
