"""Catégories, piliers et types de questions (référentiel unique)."""

from __future__ import annotations

CATEGORIES: dict[str, str] = {
    "culture": "Culture générale",
    "logique": "Logique",
    "reflexion": "Réflexion",
    "geographie": "Géographie",
    "histoire": "Histoire",
    "sciences": "Sciences",
    "nature": "Nature et animaux",
    "arts": "Arts et culture",
    "sport": "Sport",
    "estimation": "Estimation",
    "vrai_faux": "Vrai ou faux",
}

PILLARS: dict[str, str] = {
    "raisonnement": "Raisonnement",
    "estimation": "Estimation",
    "memoire": "Mémoire et culture",
    "esprit_critique": "Esprit critique",
}

CATEGORY_PILLAR: dict[str, str] = {
    "logique": "raisonnement",
    "reflexion": "raisonnement",
    "estimation": "estimation",
    "geographie": "estimation",
    "sciences": "estimation",
    "culture": "memoire",
    "histoire": "memoire",
    "arts": "memoire",
    "nature": "memoire",
    "sport": "memoire",
    "vrai_faux": "esprit_critique",
}

# Piliers qui demandent de réfléchir plutôt que de se souvenir (vision : au moins 4 sur 10).
THINKING_PILLARS = {"raisonnement", "estimation", "esprit_critique"}

QUESTION_TYPES = ("binary", "mcq", "numeric", "short_text")
STATUSES = ("draft", "published", "retired")


def pillar_of(category: str) -> str:
    return CATEGORY_PILLAR.get(category, "memoire")

# --- Structure d'une question : ce qu'on montre (entrée) et ce qu'on attend (réponse) ---

# Format d'entrée, déduit du nombre de photos.
INPUT_FORMATS: dict[str, str] = {
    "text": "Texte",
    "image": "Photo",
    "images2": "2 photos",
}

# Format de réponse = champ `type` d'une question.
ANSWER_FORMATS: dict[str, str] = {
    "binary": "Vrai / Faux",
    "mcq": "QCM (4 choix)",
    "numeric": "Nombre",
    "short_text": "Texte libre",
}

DIFFICULTIES: dict[int, str] = {1: "Facile", 2: "Moyen", 3: "Difficile"}

MAX_IMAGES = 2


def input_format(image_count: int) -> str:
    if image_count >= 2:
        return "images2"
    return "image" if image_count == 1 else "text"
