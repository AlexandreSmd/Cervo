"""Calcul des scores (module pur, sans dépendance externe).

Chaque question donne un score entier de 0 à 100 (section 5 de PRODUCT.md).
"""

from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

# Échelle log : 0 point quand on se trompe d'un facteur 3 (estimations) ou 2 (tailles).
DEFAULT_LOG_FACTOR = 3.0
SIZE_LOG_FACTOR = 2.0
# Pourcentage : 100 points à 1 point près, 0 point à 20 points d'écart (réglable par question).
PERCENT_EXACT = 1.0
DEFAULT_PERCENT_TOLERANCE = 20.0
# Devinette : points selon le nombre d'indices vus au moment de répondre (1er indice offert).
CLUE_SCORES = (100, 75, 50, 30, 20)
# Rappel sans ordre : un élément inventé coûte la moitié d'un élément retrouvé.
RECALL_EXTRA_PENALTY = 0.5


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


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
    """Estimation : score selon l'écart, linéaire (± tolérance) ou en proportion (facteur)."""
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


def same_choice(a: Any, b: Any) -> bool:
    """Égalité de deux libellés, sans tenir compte de la casse ni des espaces autour."""
    return unicodedata.normalize("NFC", str(a)).strip().casefold() == unicodedata.normalize("NFC", str(b)).strip().casefold()


def normalize_text(value: Any) -> str:
    """Forme canonique pour comparer des textes : minuscules, sans accents ni ponctuation."""
    text = unicodedata.normalize("NFKD", str(value)).lower()
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("œ", "oe").replace("æ", "ae")
    return re.sub(r"[^a-z0-9]", "", text)


def score_short_text(answer: Any, expected: Any, aliases: list | None = None) -> int:
    """Réponse courte : nombre comparé exactement, texte comparé sans casse ni accents (+ alias)."""
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


_ARTICLES = re.compile(r"^(?:le|la|les|l|un|une|des|du|de|d)\b[\s']*", re.IGNORECASE)


def normalize_guess(value: Any) -> str:
    """Réponse à une devinette : sans article au début (« le koala » = « koala »), ni casse ni accents."""
    text = unicodedata.normalize("NFC", str(value)).strip().replace("’", "'")
    return normalize_text(_ARTICLES.sub("", text, count=1)) or normalize_text(text)


def score_riddle(answer: Any, expected: Any, aliases: list | None, clues_seen: int) -> int:
    """Devinette : bonne réponse = points selon les indices vus ; mauvaise réponse = 0."""
    if answer is None or not normalize_guess(answer):
        return 0
    accepted = {normalize_guess(expected)} | {normalize_guess(a) for a in (aliases or [])}
    if normalize_guess(answer) not in accepted:
        return 0
    index = min(max(clues_seen, 1), len(CLUE_SCORES)) - 1
    return CLUE_SCORES[index]


def score_percent(answer: Any, truth: float, tolerance: float | None = None) -> int:
    """Pourcentage : écart en points (et non en proportion) ; 100 points à 1 point près."""
    value = parse_number(answer)
    if value is None or not 0 <= value <= 100:
        return 0
    gap = abs(value - float(truth))
    if gap <= PERCENT_EXACT:
        return 100
    return clamp_score(100 * (1 - gap / float(tolerance or DEFAULT_PERCENT_TOLERANCE)))


def recall_tokens(answer: Any, expected: list) -> list[str]:
    """Éléments saisis par le joueur, normalisés (une liste, ou un texte à découper).

    Si chaque élément attendu tient en un caractère (une suite de chiffres), « 4 8 1 5 »,
    « 4815 » et « 4-8-1-5 » donnent la même chose.
    """
    if isinstance(answer, list):
        raw = [str(a) for a in answer]
    elif isinstance(answer, (str, int, float)) and not isinstance(answer, bool):
        text = str(answer)
        if all(len(normalize_text(e)) == 1 for e in expected):
            raw = list(re.sub(r"[^0-9A-Za-zÀ-ÿ]", "", text))
        else:
            raw = re.split(r"[\s,;/]+", text)
    else:
        return []
    return [t for t in (normalize_text(r) for r in raw) if t]


def score_recall(answer: Any, expected: list, ordered: bool) -> int:
    """Rappel : retrouver les éléments mémorisés, dans l'ordre ou non."""
    target = [normalize_text(e) for e in expected]
    given = recall_tokens(answer, expected)
    if not target or not given:
        return 0
    if ordered:
        return clamp_score(100 * (1 - word_distance(given, target) / len(target)))
    remaining = list(target)
    hits = 0
    for token in given:
        if token in remaining:
            remaining.remove(token)
            hits += 1
    extras = len(given) - hits
    return clamp_score(100 * (hits - RECALL_EXTRA_PENALTY * extras) / len(target))


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


def dictation_words(text: Any) -> list[str]:
    """Mots d'une dictée : casse et ponctuation ignorées, accents conservés (ils comptent !)."""
    cleaned = unicodedata.normalize("NFC", str(text)).lower()
    cleaned = cleaned.replace("’", "'").replace("œ", "oe").replace("æ", "ae")
    cleaned = re.sub(r"[^\w']+", " ", cleaned)
    return [w for w in re.split(r"[\s']+", cleaned) if w]


def word_distance(a: list[str], b: list[str]) -> int:
    """Distance d'édition entre deux suites de mots (mots oubliés, ajoutés ou mal écrits)."""
    prev = list(range(len(b) + 1))
    for i, wa in enumerate(a, 1):
        cur = [i]
        for j, wb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (wa != wb)))
        prev = cur
    return prev[-1]


def score_dictation(answer: Any, expected: str) -> int:
    """Pourcentage de mots justes : chaque faute (mot faux, oublié ou en trop) retire sa part."""
    if not isinstance(answer, str) or not answer.strip():
        return 0
    target = dictation_words(expected)
    if not target:
        return 0
    errors = word_distance(dictation_words(answer), target)
    return clamp_score(100 * (1 - errors / len(target)))


def score_order(answer: Any, expected: list) -> int:
    """Remettre dans l'ordre : part des paires d'éléments dans le bon ordre relatif."""
    if not isinstance(answer, list) or sorted(map(str, answer)) != sorted(map(str, expected)):
        return 0
    rank = {str(item): i for i, item in enumerate(expected)}
    given = [rank[str(item)] for item in answer]
    pairs = len(given) * (len(given) - 1) // 2
    good = sum(1 for i in range(len(given)) for j in range(i + 1, len(given)) if given[i] < given[j])
    return clamp_score(100 * good / pairs) if pairs else 0


def score_answer(question: dict, answer: Any, clues_seen: int = 1) -> int:
    """Score (0 à 100) d'une réponse pour une question au format de la banque.

    `clues_seen` : indices vus par le joueur (devinettes uniquement).
    Pour ajouter un format de réponse : une fonction `score_<type>` ici, un cas ci-dessous,
    un contrôle dans `models._ANSWER_CHECKS` (voir docs/ARCHITECTURE.md).
    """
    if answer is None:  # temps écoulé sans réponse
        return 0
    correct = question["correct_answer"]
    match question["type"]:
        case "binary":
            given = to_bool(answer)
            return 100 if given is not None and given == bool(correct) else 0
        case "mcq":
            # Comparaison exacte, accents compris : certains QCM portent sur l'orthographe.
            return 100 if same_choice(answer, correct) else 0
        case "numeric":
            return score_numeric(answer, correct, question.get("numeric_config"))
        case "short_text":
            return score_short_text(answer, correct, question.get("accepted_aliases"))
        case "order":
            return score_order(answer, correct)
        case "size":
            factor = (question.get("numeric_config") or {}).get("factor") or SIZE_LOG_FACTOR
            return score_numeric(answer, correct, {"scale": "log", "factor": factor})
        case "dictation":
            return score_dictation(answer, correct)
        case "percent":
            return score_percent(answer, correct, (question.get("numeric_config") or {}).get("tolerance"))
        case "recall":
            return score_recall(answer, correct, bool(question.get("recall_ordered")))
        case "riddle":
            return score_riddle(answer, correct, question.get("accepted_aliases"), clues_seen)
    raise ValueError(f"Type de question inconnu : {question['type']}")


def day_score(scores: list[int]) -> int:
    if not scores:
        return 0
    return round_half_up(sum(scores) / len(scores))
