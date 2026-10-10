"""Modèles Pydantic : format de la banque de questions et requêtes de l'API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .catalog import CATEGORIES, MAX_IMAGES, input_format
from .scoring import normalize_text, same_choice


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
    def slider_bounds(self) -> "NumericConfig":
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
    """Phase de mémorisation : on montre, on cache, puis on pose la question."""
    items: list[str] = Field(default_factory=list, max_length=12)
    seconds: int = Field(default=5, ge=2, le=15)
    hide_images: bool = False


class ImageRef(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    alt: str = Field(min_length=1, max_length=300)
    credit: str | None = Field(default=None, max_length=300)


class Question(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    type: Literal["binary", "mcq", "numeric", "short_text", "order", "size", "dictation"]
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
    time_limit: int | None = Field(default=None, ge=5, le=120)
    explanation: str = Field(min_length=10, max_length=1000)
    source_url: str | None = None
    status: Literal["draft", "published", "retired"] = "published"

    @model_validator(mode="before")
    @classmethod
    def legacy_image(cls, data: Any) -> Any:
        """Ancien format (image_url, image_alt, image_credit) → images[0]."""
        if isinstance(data, dict) and data.get("image_url"):
            data = dict(data)
            image = {"url": data.pop("image_url"), "alt": data.pop("image_alt", None) or "Illustration", "credit": data.pop("image_credit", None)}
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
        if v not in CATEGORIES:
            raise ValueError(f"catégorie inconnue « {v} » (attendu : {', '.join(CATEGORIES)})")
        return v

    @model_validator(mode="after")
    def coherent_answer(self) -> "Question":
        if self.type == "binary" and not isinstance(self.correct_answer, bool):
            raise ValueError("une question vrai/faux attend true ou false")
        if self.type == "mcq":
            if not self.choices or len(self.choices) != 4:
                raise ValueError("un QCM attend exactement 4 choix")
            if any(same_choice(a, b) for i, a in enumerate(self.choices) for b in self.choices[i + 1:]):
                raise ValueError("les choix du QCM doivent être différents")
            if not any(same_choice(self.correct_answer, c) for c in self.choices):
                raise ValueError("la bonne réponse doit faire partie des choix")
        if self.type == "numeric":
            if isinstance(self.correct_answer, bool) or not isinstance(self.correct_answer, (int, float)):
                raise ValueError("une question numérique attend un nombre")
            if self.numeric_config is None:
                raise ValueError("une question numérique attend numeric_config")
            if self.numeric_config.scale == "log" and self.correct_answer <= 0:
                raise ValueError("l'échelle log attend une réponse strictement positive")
        if self.type == "order":
            items = self.correct_answer
            if not isinstance(items, list) or not 3 <= len(items) <= 6 or not all(isinstance(i, str) and i.strip() for i in items):
                raise ValueError("un classement attend 3 à 6 éléments, dans le bon ordre")
            if len({normalize_text(i) for i in items}) != len(items):
                raise ValueError("les éléments à classer doivent être différents")
        if self.type == "size":
            if self.size_config is None:
                raise ValueError("une question de taille attend size_config (référence et cible)")
            if isinstance(self.correct_answer, bool) or not isinstance(self.correct_answer, (int, float)) or self.correct_answer <= 0:
                raise ValueError("une question de taille attend un rapport positif")
            if not self.size_config.min < self.correct_answer < self.size_config.max:
                raise ValueError("le rapport doit être compris entre min et max du curseur")
        if self.type == "dictation":
            if not isinstance(self.correct_answer, str) or len(self.correct_answer.split()) < 3:
                raise ValueError("une dictée attend un texte d'au moins 3 mots")
        if self.memorize and not self.memorize.items and not (self.memorize.hide_images and self.images):
            raise ValueError("la mémorisation attend des éléments à montrer ou des photos à cacher")
        if self.type == "short_text":
            if isinstance(self.correct_answer, bool) or not isinstance(self.correct_answer, (str, int, float)):
                raise ValueError("une réponse courte attend un texte ou un nombre")
            if isinstance(self.correct_answer, str) and not normalize_text(self.correct_answer):
                raise ValueError("la réponse attendue est vide")
        return self


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
            if len(v) > 8 or not all(isinstance(i, str) and len(i) <= 120 for i in v):
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
    question_ids: list[str] = Field(min_length=10, max_length=10)


class FillIn(BaseModel):
    days: int = Field(default=28, ge=1, le=120)


class MediaIn(BaseModel):
    data_url: str = Field(max_length=1_400_000)
