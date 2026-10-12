"""Référentiel unique : les 10 types de question, leur ordre dans le quiz, leurs règles de jeu.

Chaque jour, le quiz pose exactement une question de chaque type, toujours dans le même ordre
(`DAILY_ORDER`). Le champ `category` d'une question porte son type (« taille », « dictee »…) ;
le champ `type` porte la mécanique de réponse (QCM, curseur, classement…), contrainte par le type.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Kind:
    label: str
    emoji: str
    pillar: str
    # Consigne courte affichée au joueur au-dessus de la question.
    instruction: str
    # Ce que le fondateur doit savoir pour écrire une bonne question de ce type.
    guide: str
    # Mécaniques de réponse autorisées (champ `type` de la question), la première par défaut.
    answer_types: tuple[str, ...]
    # Chrono de base par difficulté (facile, moyen, difficile), en secondes. None : pas de chrono.
    base_time: tuple[int, int, int] | None


# L'ordre du dictionnaire EST l'ordre du quiz : un échauffement rapide, puis une alternance de
# mécaniques (toucher, glisser, taper) et de rythmes, le gros effort de réflexion en 9e position,
# et la dictée, sans chrono, pour finir au calme.
KINDS: dict[str, Kind] = {
    "vocabulaire": Kind(
        label="Vocabulaire",
        emoji="📖",
        pillar="langage",
        instruction="Le mot juste",
        guide=(
            "Synonyme, contraire, sens précis d'un mot ou d'une expression. 4 choix plausibles : les pièges sont "
            "des paronymes ou des faux amis."
        ),
        answer_types=("mcq",),
        base_time=(12, 15, 18),
    ),
    "taille": Kind(
        label="Taille",
        emoji="📏",
        pillar="estimation",
        instruction="Ajuste la taille",
        guide=(
            "Deux objets du quotidien ou de la nature : l'un est fixe, le joueur agrandit ou réduit l'autre. Le "
            "rapport doit être vérifiable (hauteur, longueur ou diamètre)."
        ),
        answer_types=("size",),
        base_time=(15, 18, 20),
    ),
    "fait": Kind(
        label="Fait étonnant",
        emoji="💡",
        pillar="culture",
        instruction="Vrai ou faux ?",
        guide=(
            "Un fait surprenant de biologie, physique, histoire ou du monde animal, sourcé. L'explication est le "
            "cœur de la question : elle doit donner envie de la raconter."
        ),
        answer_types=("binary", "mcq"),
        base_time=(15, 18, 20),
    ),
    "memoire": Kind(
        label="Mémoire",
        emoji="🧠",
        pillar="memoire",
        instruction="Regarde bien, puis réponds",
        guide=(
            "Une liste (mots, chiffres, emojis) montrée quelques secondes puis cachée. Ensuite : retrouver "
            "l'intrus (QCM), tout réécrire (rappel) ou remettre dans l'ordre d'apparition."
        ),
        answer_types=("recall", "mcq", "order"),
        base_time=(15, 20, 25),
    ),
    "stat": Kind(
        label="Statistique",
        emoji="📊",
        pillar="estimation",
        instruction="Devine le pourcentage",
        guide=(
            "Un pourcentage réel sur une population (monde, France…) : « Quelle part des adultes… ? ». Source "
            "fiable obligatoire, chiffre récent."
        ),
        answer_types=("percent",),
        base_time=(15, 18, 20),
    ),
    "chronologie": Kind(
        label="Chronologie",
        emoji="⏳",
        pillar="culture",
        instruction="Du plus ancien au plus récent",
        guide=(
            "4 à 5 événements à classer (histoire, inventions, pop culture…). Mélange des époques proches et "
            "lointaines ; chaque élément a sa date, montrée après la réponse."
        ),
        answer_types=("order",),
        base_time=(20, 25, 30),
    ),
    "estimation": Kind(
        label="Estimation",
        emoji="⚖️",
        pillar="estimation",
        instruction="Ton estimation",
        guide=(
            "Une grandeur moyenne (poids, taille, durée, distance…). Score en proportion : l'ordre de grandeur "
            "compte plus que le chiffre exact."
        ),
        answer_types=("numeric",),
        base_time=(15, 20, 25),
    ),
    "devinette": Kind(
        label="Devinette",
        emoji="🕵️",
        pillar="logique",
        instruction="Trouve avec le moins d'indices",
        guide=(
            "Un animal, un pays, une personne, un objet… 4 à 5 indices du plus vague au plus précis. Chaque "
            "indice demandé coûte des points."
        ),
        answer_types=("riddle",),
        base_time=(40, 45, 50),
    ),
    "enigme": Kind(
        label="Énigme",
        emoji="🧩",
        pillar="logique",
        instruction="Prends le temps de réfléchir",
        guide=(
            "Un problème qui se résout par le raisonnement, pas par la culture : suite, logique, petit calcul malin, piège d'intuition."
        ),
        answer_types=("mcq", "short_text"),
        base_time=(45, 60, 90),
    ),
    "dictee": Kind(
        label="Dictée",
        emoji="✍️",
        pillar="langage",
        instruction="Écoute et écris",
        guide=(
            "Deux phrases, lues par la voix du téléphone. Pas de chrono : le joueur réécoute autant qu'il veut. "
            "Viser les accords et les pièges classiques."
        ),
        answer_types=("dictation",),
        base_time=None,
    ),
}

DAILY_ORDER: tuple[str, ...] = tuple(KINDS)
CATEGORIES: dict[str, str] = {key: kind.label for key, kind in KINDS.items()}

PILLARS: dict[str, str] = {
    "logique": "Logique",
    "estimation": "Estimation",
    "memoire": "Mémoire",
    "langage": "Langage",
    "culture": "Culture",
}

# Anciennes catégories (questions d'avant les 10 types) : gardées pour afficher l'historique.
LEGACY_CATEGORIES: dict[str, tuple[str, str]] = {
    "culture": ("Culture générale", "culture"),
    "logique": ("Logique", "logique"),
    "reflexion": ("Réflexion", "logique"),
    "geographie": ("Géographie", "culture"),
    "histoire": ("Histoire", "culture"),
    "sciences": ("Sciences", "culture"),
    "nature": ("Nature et animaux", "culture"),
    "arts": ("Arts et culture", "culture"),
    "sport": ("Sport", "culture"),
    "vrai_faux": ("Vrai ou faux", "culture"),
    "langue": ("Langue française", "langage"),
}
# Anciens piliers stockés dans les profils, regroupés dans les nouveaux.
LEGACY_PILLARS: dict[str, str] = {"raisonnement": "logique", "esprit_critique": "culture"}


def kind_of(category: str) -> Kind | None:
    return KINDS.get(category)


def category_label(category: str) -> str:
    if category in KINDS:
        return KINDS[category].label
    return LEGACY_CATEGORIES.get(category, (category, ""))[0]


def pillar_of(category: str) -> str:
    if category in KINDS:
        return KINDS[category].pillar
    return LEGACY_CATEGORIES.get(category, ("", "culture"))[1]


# --- Structure d'une question : ce qu'on montre (entrée) et ce qu'on attend (réponse) ---

INPUT_FORMATS: dict[str, str] = {
    "text": "Texte",
    "image": "Photo",
    "images2": "2 photos",
}

# Mécanique de réponse = champ `type` d'une question.
ANSWER_FORMATS: dict[str, str] = {
    "binary": "Vrai / Faux",
    "mcq": "QCM (4 choix)",
    "numeric": "Nombre",
    "short_text": "Texte libre",
    "order": "Classement",
    "size": "Taille (curseur)",
    "dictation": "Dictée",
    "recall": "Rappel (réécrire la liste)",
    "percent": "Pourcentage (curseur)",
    "riddle": "Devinette à indices",
}

# Délai de grâce côté serveur (réseau, animation) avant de considérer le temps écoulé.
TIME_GRACE = 4

DIFFICULTIES: dict[int, str] = {1: "Facile", 2: "Moyen", 3: "Difficile"}

MAX_IMAGES = 2


def input_format(image_count: int) -> str:
    if image_count >= 2:
        return "images2"
    return "image" if image_count == 1 else "text"
