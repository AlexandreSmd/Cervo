"""Modèles Pydantic : format de la banque de questions et requêtes de l'API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .catalog import CATEGORIES
from .scoring import normalize_text


class NumericConfig(BaseModel):
    scale: Literal["linear", "log"] = "linear"
    tolerance: float | None = Field(default=None, gt=0)
    factor: float | None = Field(default=None, gt=1)
    unit: str | None = None
    exact_margin: float | None = Field(default=None, ge=0)


class Question(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    type: Literal["binary", "mcq", "numeric", "short_text"]
    category: str
    tags: list[str] = Field(default_factory=list)
    difficulty: int = Field(ge=1, le=3)
    prompt: str = Field(min_length=5, max_length=500)
    image_url: str | None = None
    image_credit: str | None = None
    image_alt: str | None = None
    choices: list[str] | None = None
    correct_answer: Any
    numeric_config: NumericConfig | None = None
    accepted_aliases: list[str] = Field(default_factory=list)
    explanation: str = Field(min_length=10, max_length=1000)
    source_url: str | None = None
    status: Literal["draft", "published", "retired"] = "published"

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
            normalized = [normalize_text(c) for c in self.choices]
            if len(set(normalized)) != 4:
                raise ValueError("les choix du QCM doivent être différents")
            if normalize_text(self.correct_answer) not in normalized:
                raise ValueError("la bonne réponse doit faire partie des choix")
        if self.type == "numeric":
            if isinstance(self.correct_answer, bool) or not isinstance(self.correct_answer, (int, float)):
                raise ValueError("une question numérique attend un nombre")
            if self.numeric_config is None:
                raise ValueError("une question numérique attend numeric_config")
            if self.numeric_config.scale == "log" and self.correct_answer <= 0:
                raise ValueError("l'échelle log attend une réponse strictement positive")
        if self.type == "short_text":
            if isinstance(self.correct_answer, bool) or not isinstance(self.correct_answer, (str, int, float)):
                raise ValueError("une réponse courte attend un texte ou un nombre")
            if isinstance(self.correct_answer, str) and not normalize_text(self.correct_answer):
                raise ValueError("la réponse attendue est vide")
        if self.image_url and not self.image_alt:
            raise ValueError("une image doit avoir un texte alternatif (image_alt)")
        return self


class AnswerIn(BaseModel):
    date: str
    question_id: str = Field(max_length=80)
    answer: Any

    @field_validator("answer")
    @classmethod
    def small_answer(cls, v: Any) -> Any:
        if isinstance(v, str) and len(v) > 200:
            raise ValueError("réponse trop longue")
        if not isinstance(v, (str, int, float, bool)) or v is None:
            raise ValueError("réponse invalide")
        return v


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
