"""Modèles Pydantic : format de la banque de questions et requêtes de l'API."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .catalog import KINDS, MAX_IMAGES, input_format
from .scoring import normalize_guess, normalize_text, same_choice


class NumericConfig(BaseModel):
    scale: Literal["linear", "log"] = "linear"
    tolerance: float | None = Field(default=None, gt=0)
    factor: float | None = Field(default=None, gt=1)
    unit: str | None = None
    exact_margin: float | None = Field(default=None, ge=0)
    # Saisie au clavier (par défaut) ou avec un curseur borné.
    input: Literal["keyboard", "slider"] = "keyboard"
    min: float | None = None
    max: float | None = None
    step: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def slider_bounds(self) -> NumericConfig:
        if self.input == "slider" and (self.min is None or self.max is None or self.min >= self.max):
            raise ValueError("un curseur attend min < max")
        return self


class SizeObject(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    emoji: str = Field(min_length=1, max_length=16)


class SizeConfig(BaseModel):
    """Comparer deux objets : la référence est fixe, le joueur ajuste la cible.

    La bonne réponse est le rapport taille(cible) / taille(référence).
    """

    reference: SizeObject
    target: SizeObject
    min: float = Field(default=0.1, gt=0)
    max: float = Field(default=10, gt=0)


class MemorizeConfig(BaseModel):
    """Phase de mémorisation : on montre, on cache, puis on pose la question.

    `seconds` vide : durée calculée selon le nombre d'éléments et la difficulté (domain/timing.py).
    """

    items: list[str] = Field(default_factory=list, max_length=12)
    seconds: int | None = Field(default=None, ge=2, le=15)
    hide_images: bool = False


class ImageRef(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    alt: str = Field(min_length=1, max_length=300)
    credit: str | None = Field(default=None, max_length=300)


QuestionType = Literal["binary", "mcq", "numeric", "short_text", "order", "size", "dictation", "recall", "percent", "riddle"]


class Question(BaseModel):
    """Une question de la banque. `category` = son type parmi les 10 (catalog.KINDS)."""

    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    type: QuestionType
    category: str
    tags: list[str] = Field(default_factory=list)
    difficulty: int = Field(ge=1, le=3)
    prompt: str = Field(min_length=5, max_length=500)
    images: list[ImageRef] = Field(default_factory=list, max_length=MAX_IMAGES)
    choices: list[str] | None = None
    correct_answer: Any
    numeric_config: NumericConfig | None = None
    accepted_aliases: list[str] = Field(default_factory=list)
    size_config: SizeConfig | None = None
    memorize: MemorizeConfig | None = None
    # Devinette : indices du plus vague au plus précis (le premier est offert).
    clues: list[str] = Field(default_factory=list, max_length=5)
    # Classement : précision montrée après la réponse pour chaque élément (date, mesure…).
    order_details: list[str] | None = None
    # Rappel : faut-il retrouver les éléments dans l'ordre ?
    recall_ordered: bool = False
    # Vide : chrono calculé (domain/timing.py).
    time_limit: int | None = Field(default=None, ge=5, le=180)
    explanation: str = Field(min_length=10, max_length=1000)
    source_url: str | None = None
    status: Literal["draft", "published", "retired"] = "published"

    @model_validator(mode="before")
    @classmethod
    def legacy_image(cls, data: Any) -> Any:
        """Ancien format (image_url, image_alt, image_credit) → images[0]."""
        if isinstance(data, dict) and data.get("image_url"):
            data = dict(data)
            image = {
                "url": data.pop("image_url"),
                "alt": data.pop("image_alt", None) or "Illustration",
                "credit": data.pop("image_credit", None),
            }
            data["images"] = [image, *(data.get("images") or [])]
        elif isinstance(data, dict):
            data = {k: v for k, v in data.items() if k not in ("image_url", "image_alt", "image_credit")}
        return data

    @property
    def input_format(self) -> str:
        return input_format(len(self.images))

    @field_validator("category")
    @classmethod
    def known_category(cls, v: str) -> str:
        if v not in KINDS:
            raise ValueError(f"type de question inconnu « {v} » (attendu : {', '.join(KINDS)})")
        return v

    @model_validator(mode="after")
    def coherent_answer(self) -> Question:
        """La mécanique doit convenir au type, et la bonne réponse avoir la forme attendue."""
        kind = KINDS[self.category]
        if self.type not in kind.answer_types:
            allowed = ", ".join(kind.answer_types)
            raise ValueError(f"une question « {kind.label} » se joue en : {allowed} (pas {self.type})")
        _ANSWER_CHECKS[self.type](self)
        _KIND_CHECKS.get(self.category, lambda q: None)(self)
        if self.memorize and not self.memorize.items and not (self.memorize.hide_images and self.images):
            raise ValueError("la mémorisation attend des éléments à montrer ou des photos à cacher")
        if self.order_details is not None and (self.type != "order" or len(self.order_details) != len(self.correct_answer)):
            raise ValueError("order_details attend une précision par élément à classer")
        return self


# --- Vérifications par format de réponse ---------------------------------------------


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _check_binary(q: Question) -> None:
    if not isinstance(q.correct_answer, bool):
        raise ValueError("une question vrai/faux attend true ou false")


def _check_mcq(q: Question) -> None:
    if not q.choices or len(q.choices) != 4:
        raise ValueError("un QCM attend exactement 4 choix")
    if any(same_choice(a, b) for i, a in enumerate(q.choices) for b in q.choices[i + 1 :]):
        raise ValueError("les choix du QCM doivent être différents")
    if not any(same_choice(q.correct_answer, c) for c in q.choices):
        raise ValueError("la bonne réponse doit faire partie des choix")


def _check_numeric(q: Question) -> None:
    if not _is_number(q.correct_answer):
        raise ValueError("une question numérique attend un nombre")
    if q.numeric_config is None:
        raise ValueError("une question numérique attend numeric_config")
    if q.numeric_config.scale == "log" and q.correct_answer <= 0:
        raise ValueError("l'échelle log attend une réponse strictement positive")


def _check_short_text(q: Question) -> None:
    if not (_is_number(q.correct_answer) or isinstance(q.correct_answer, str)):
        raise ValueError("une réponse courte attend un texte ou un nombre")
    if isinstance(q.correct_answer, str) and not normalize_text(q.correct_answer):
        raise ValueError("la réponse attendue est vide")


def _check_order(q: Question) -> None:
    items = q.correct_answer
    if not isinstance(items, list) or not 3 <= len(items) <= 6 or not all(isinstance(i, str) and i.strip() for i in items):
        raise ValueError("un classement attend 3 à 6 éléments, dans le bon ordre")
    if len({normalize_text(i) for i in items}) != len(items):
        raise ValueError("les éléments à classer doivent être différents")


def _check_size(q: Question) -> None:
    if q.size_config is None:
        raise ValueError("une question de taille attend size_config (référence et cible)")
    if not _is_number(q.correct_answer) or q.correct_answer <= 0:
        raise ValueError("une question de taille attend un rapport positif")
    if not q.size_config.min < q.correct_answer < q.size_config.max:
        raise ValueError("le rapport doit être compris entre min et max du curseur")


def _check_dictation(q: Question) -> None:
    if not isinstance(q.correct_answer, str) or len(q.correct_answer.split()) < 3:
        raise ValueError("une dictée attend un texte d'au moins 3 mots")


def _check_recall(q: Question) -> None:
    items = q.correct_answer
    if not isinstance(items, list) or not 3 <= len(items) <= 12 or not all(isinstance(i, str) and normalize_text(i) for i in items):
        raise ValueError("un rappel attend 3 à 12 éléments à retrouver")
    if q.memorize is None or not q.memorize.items:
        raise ValueError("un rappel attend une phase de mémorisation (memorize.items)")


def _check_percent(q: Question) -> None:
    if not _is_number(q.correct_answer) or not 0 <= q.correct_answer <= 100:
        raise ValueError("un pourcentage attend un nombre entre 0 et 100")


def _check_riddle(q: Question) -> None:
    if not isinstance(q.correct_answer, str) or not normalize_guess(q.correct_answer):
        raise ValueError("une devinette attend la réponse en texte")
    if not 3 <= len(q.clues) <= 5 or not all(c.strip() for c in q.clues):
        raise ValueError("une devinette attend 3 à 5 indices, du plus vague au plus précis")


_ANSWER_CHECKS = {
    "binary": _check_binary,
    "mcq": _check_mcq,
    "numeric": _check_numeric,
    "short_text": _check_short_text,
    "order": _check_order,
    "size": _check_size,
    "dictation": _check_dictation,
    "recall": _check_recall,
    "percent": _check_percent,
    "riddle": _check_riddle,
}


# --- Règles propres à certains types ------------------------------------------------


def _kind_chronologie(q: Question) -> None:
    if not q.order_details:
        raise ValueError("une chronologie attend la date de chaque événement (order_details)")


def _kind_memoire(q: Question) -> None:
    if q.memorize is None:
        raise ValueError("une question de mémoire attend une phase de mémorisation (memorize)")


def _kind_dictee(q: Question) -> None:
    sentences = [s for s in re.split(r"[.!?…]+", str(q.correct_answer)) if s.strip()]
    if len(sentences) < 2:
        raise ValueError("une dictée attend deux phrases")


_KIND_CHECKS = {"chronologie": _kind_chronologie, "memoire": _kind_memoire, "dictee": _kind_dictee}


# --- Requêtes de l'API ------------------------------------------------------------


class AnswerIn(BaseModel):
    date: str
    question_id: str = Field(max_length=80)
    answer: Any = None  # None : temps écoulé sans réponse

    @field_validator("answer")
    @classmethod
    def small_answer(cls, v: Any) -> Any:
        if v is None:
            return v
        if isinstance(v, list):
            if len(v) > 12 or not all(isinstance(i, str) and len(i) <= 120 for i in v):
                raise ValueError("réponse invalide")
            return v
        if isinstance(v, str) and len(v) > 600:
            raise ValueError("réponse trop longue")
        if not isinstance(v, (str, int, float, bool)):
            raise ValueError("réponse invalide")
        return v


class StartIn(BaseModel):
    date: str
    question_id: str = Field(max_length=80)


class ClueIn(StartIn):
    """Demande de l'indice suivant d'une devinette."""


class ReportIn(BaseModel):
    question_id: str = Field(max_length=80)
    reason: str = Field(min_length=3, max_length=500)


class UsernameIn(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9À-ÿ_.-]+$")


class ImportIn(BaseModel):
    questions: list[dict]
    overwrite: bool = False


class StatusIn(BaseModel):
    status: Literal["draft", "published", "retired"]


class ScheduleDayIn(BaseModel):
    question_ids: list[str] = Field(min_length=1, max_length=10)


class FillIn(BaseModel):
    days: int = Field(default=28, ge=1, le=120)


class MediaIn(BaseModel):
    data_url: str = Field(max_length=1_400_000)
