"""Composition du quiz du jour (module pur et déterministe).

Même date + même banque + même historique = même quiz. Le résultat est ensuite
figé dans Firestore (`daily_quizzes/{date}`) à la première demande du jour.
"""

from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .catalog import THINKING_PILLARS, pillar_of

QUIZ_SIZE = 10
# Quiz exigeant : 2 faciles pour se lancer, 4 moyennes, 4 difficiles.
DIFFICULTY_QUOTAS = {1: 2, 2: 4, 3: 4}
MAX_PER_CATEGORY = 3
MIN_CATEGORIES = 5
MIN_NUMERIC = 2
MIN_IMAGES = 1
MIN_THINKING = 4
# Taille minimale du vivier après exclusion des questions déjà posées.
MIN_POOL = 40
ATTEMPTS_PER_LEVEL = 60

# Ordre d'assouplissement (section 7) : difficulté, puis catégories, puis images.
RELAX_LEVELS = (
    {"difficulty": True, "categories": True, "images": True},
    {"difficulty": False, "categories": True, "images": True},
    {"difficulty": False, "categories": False, "images": True},
    {"difficulty": False, "categories": False, "images": False},
)


def seeded_rng(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def today_str(tz_name: str = "Europe/Paris", now: datetime | None = None) -> str:
    now = now or datetime.now(ZoneInfo(tz_name))
    if now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo(tz_name))
    return now.astimezone(ZoneInfo(tz_name)).date().isoformat()


def previous_day(day: str) -> str:
    return (date.fromisoformat(day) - timedelta(days=1)).isoformat()


def is_valid_day(day: str) -> bool:
    try:
        return date.fromisoformat(day).isoformat() == day
    except (TypeError, ValueError):
        return False


def stable_choices(question_id: str, choices: list[str]) -> list[str]:
    """Ordre des choix de QCM mélangé de façon stable pour une question donnée."""
    shuffled = list(choices)
    seeded_rng(f"choices:{question_id}").shuffle(shuffled)
    return shuffled


def _is_numeric(q: dict) -> bool:
    return q.get("type") == "numeric"


def _has_image(q: dict) -> bool:
    return bool(q.get("images") or q.get("image_url"))


def _is_thinking(q: dict) -> bool:
    return pillar_of(q.get("category", "")) in THINKING_PILLARS


def _try_build(order: list[dict], level: dict) -> list[dict] | None:
    selected: list[dict] = []
    cat_count: dict[str, int] = {}
    diff_count: dict[int, int] = {}
    chosen_ids: set[str] = set()

    def can_add(q: dict) -> bool:
        if q["id"] in chosen_ids:
            return False
        if level["categories"] and cat_count.get(q["category"], 0) >= MAX_PER_CATEGORY:
            return False
        if level["difficulty"]:
            d = int(q.get("difficulty", 2))
            if diff_count.get(d, 0) >= DIFFICULTY_QUOTAS.get(d, 0):
                return False
        return True

    def add(q: dict) -> None:
        selected.append(q)
        chosen_ids.add(q["id"])
        cat_count[q["category"]] = cat_count.get(q["category"], 0) + 1
        d = int(q.get("difficulty", 2))
        diff_count[d] = diff_count.get(d, 0) + 1

    def fill(predicate, target_count) -> None:
        for q in order:
            if len(selected) >= QUIZ_SIZE or sum(1 for s in selected if predicate(s)) >= target_count:
                return
            if predicate(q) and can_add(q):
                add(q)

    strict = level["categories"]
    if level["images"]:
        fill(_has_image, MIN_IMAGES)
    if strict:
        fill(_is_numeric, MIN_NUMERIC)
        fill(_is_thinking, MIN_THINKING)
    fill(lambda q: True, QUIZ_SIZE)

    if len(selected) != QUIZ_SIZE:
        return None
    if level["images"] and sum(_has_image(q) for q in selected) < MIN_IMAGES:
        return None
    if strict:
        if len(cat_count) < MIN_CATEGORIES:
            return None
        if sum(_is_numeric(q) for q in selected) < MIN_NUMERIC:
            return None
        if sum(_is_thinking(q) for q in selected) < MIN_THINKING:
            return None
    return selected


def candidate_pool(questions: list[dict], history: list[list[str]] | None = None) -> list[dict]:
    """Questions publiées, sans celles posées récemment tant que le vivier reste suffisant.

    `history` : listes d'identifiants des jours précédents, du plus récent au plus ancien.
    """
    published = sorted(
        (q for q in questions if q.get("status", "published") == "published"),
        key=lambda q: q["id"],
    )
    excluded: set[str] = set()
    for day_ids in history or []:
        candidate = excluded | set(day_ids)
        if sum(1 for q in published if q["id"] not in candidate) < MIN_POOL:
            break
        excluded = candidate
    return [q for q in published if q["id"] not in excluded]


def build_daily_quiz(day: str, questions: list[dict], history: list[list[str]] | None = None) -> list[str]:
    """Renvoie les identifiants des 10 questions du jour `day` (AAAA-MM-JJ)."""
    pool = candidate_pool(questions, history)
    if len(pool) < QUIZ_SIZE:
        raise ValueError(f"Banque insuffisante : {len(pool)} questions publiées, il en faut {QUIZ_SIZE}.")
    rng = seeded_rng(f"daily:{day}")
    for level in RELAX_LEVELS:
        for _ in range(ATTEMPTS_PER_LEVEL):
            order = list(pool)
            rng.shuffle(order)
            selected = _try_build(order, level)
            if selected:
                rng.shuffle(selected)
                selected.sort(key=lambda q: int(q.get("difficulty", 2)))
                return [q["id"] for q in selected]
    raise ValueError("Impossible de composer le quiz du jour.")  # pragma: no cover
