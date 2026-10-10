"""Calcul des scores (module pur, sans dépendance externe).

Chaque question donne un score entier de 0 à 100 (section 5 de PRODUCT.md).
"""

from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

DEFAULT_LOG_FACTOR = 3.0


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def clamp_score(x: float) -> int:
    return max(0, min(100, round_half_up(x)))


def parse_number(value: Any) -> float | None:
    """Convertit une saisie en nombre (accepte « 1 234,5 », « 384 400 », « 1.5e3 »)."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    if not isinstance(value, str):
        return None
    text = value.strip().replace(" ", "").replace(" ", "").replace(" ", "")
    text = text.replace("_", "")
    if text.count(",") == 1 and "." not in text:
        text = text.replace(",", ".")
    elif "," in text:
        text = text.replace(",", "")
    try:
        number = float(text)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def score_numeric(answer: Any, truth: float, config: dict | None) -> int:
    config = config or {}
    value = parse_number(answer)
    if value is None:
        return 0
    truth = float(truth)
    scale = config.get("scale", "linear")
    exact_margin = float(config.get("exact_margin") or 0)
    # Réponse exacte ou dans la marge de la question : 100. La règle « à moins de 1 % »
    # ne s'applique qu'en échelle log : sur une année (linéaire), 1 % ferait ±20 ans.
    relative = abs(truth) * 0.01 if scale == "log" else 0.0
    if abs(value - truth) <= max(exact_margin, relative):
        return 100
    if scale == "log":
        if value <= 0 or truth <= 0:
            return 0
        factor = float(config.get("factor") or DEFAULT_LOG_FACTOR)
        if factor <= 1:
            return 0
        return clamp_score(100 * (1 - abs(math.log(value / truth)) / math.log(factor)))
    tolerance = config.get("tolerance")
    tolerance = float(tolerance) if tolerance else max(abs(truth) * 0.1, 1.0)
    return clamp_score(100 * (1 - abs(value - truth) / tolerance))


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value)).lower()
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("œ", "oe").replace("æ", "ae")
    return re.sub(r"[^a-z0-9]", "", text)


def score_short_text(answer: Any, expected: Any, aliases: list | None = None) -> int:
    if answer is None:
        return 0
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        value = parse_number(answer)
        return 100 if value is not None and value == float(expected) else 0
    normalized = normalize_text(answer)
    if not normalized:
        return 0
    accepted = {normalize_text(expected)} | {normalize_text(a) for a in (aliases or [])}
    return 100 if normalized in accepted else 0


def to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = normalize_text(value)
        if v in {"true", "vrai", "oui", "1"}:
            return True
        if v in {"false", "faux", "non", "0"}:
            return False
    return None


def score_answer(question: dict, answer: Any) -> int:
    """Score d'une réponse pour une question (dict au format de la banque)."""
    qtype = question["type"]
    correct = question["correct_answer"]
    if qtype == "binary":
        given = to_bool(answer)
        return 100 if given is not None and given == bool(correct) else 0
    if qtype == "mcq":
        return 100 if answer is not None and normalize_text(answer) == normalize_text(correct) else 0
    if qtype == "numeric":
        return score_numeric(answer, correct, question.get("numeric_config"))
    if qtype == "short_text":
        return score_short_text(answer, correct, question.get("accepted_aliases"))
    raise ValueError(f"Type de question inconnu : {qtype}")


def day_score(scores: list[int]) -> int:
    if not scores:
        return 0
    return round_half_up(sum(scores) / len(scores))


def score_color(score: int) -> str:
    if score >= 80:
        return "green"
    if score >= 40:
        return "orange"
    return "red"
