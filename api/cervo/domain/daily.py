"""Composition du quiz du jour (module pur et déterministe).

Même date + même banque + même historique = même quiz. Le résultat est ensuite
figé dans Firestore (`daily_quizzes/{date}`) à la première demande du jour.
"""

from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .catalog import DAILY_ORDER, KINDS

# Une question de chaque type, toujours dans le même ordre (catalog.DAILY_ORDER).
QUIZ_SIZE = len(DAILY_ORDER)
# Répartition visée des difficultés sur une journée : on se lance, on transpire, on finit fier.
DIFFICULTY_TARGET = {1: 3, 2: 4, 3: 3}
# Une question posée il y a au moins ce nombre de jours est considérée comme « fraîche ».
COMFORT_GAP_DAYS = 60


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


def _gap_days(day: str, planned: dict[str, list[str]]) -> dict[str, int]:
    """Pour chaque question, l'écart (en jours) avec son utilisation la plus proche de `day`.

    Le futur compte aussi : une question déjà planifiée dans 10 jours n'est pas reprise aujourd'hui.
    """
    target = date.fromisoformat(day)
    gaps: dict[str, int] = {}
    for other, ids in planned.items():
        if other == day:
            continue
        gap = abs((date.fromisoformat(other) - target).days)
        for qid in ids:
            gaps[qid] = min(gaps.get(qid, gap), gap)
    return gaps


def _difficulty(q: dict) -> int:
    return int(q.get("difficulty", 2))


def published_by_kind(questions: list[dict]) -> dict[str, list[dict]]:
    """Questions publiées des 10 types, triées par identifiant (résultat indépendant de l'ordre reçu)."""
    by_kind: dict[str, list[dict]] = {k: [] for k in DAILY_ORDER}
    for q in sorted(questions, key=lambda q: q["id"]):
        if q.get("status", "published") == "published" and q.get("category") in KINDS:
            by_kind[q["category"]].append(q)
    return by_kind


def build_daily_quiz(day: str, questions: list[dict], planned: dict[str, list[str]] | None = None) -> list[str]:
    """Les 10 identifiants du jour `day`, un par type, dans l'ordre du quiz.

    Pour chaque type : la question la moins récemment posée (jamais posée d'abord), et parmi
    les plus fraîches, celle qui rapproche la journée de la répartition 3 faciles, 4 moyennes,
    3 difficiles. Le hasard (graine = date) départage : même date, même banque = même quiz.
    `planned` : les autres journées connues {date: [ids]}, passées et à venir.

    Si un type n'a aucune question publiée, sa place est prise par la question la plus fraîche
    d'un autre type (le quiz garde ses 10 questions ; le planning le signale).
    """
    by_kind = published_by_kind(questions)
    total = sum(len(v) for v in by_kind.values())
    if total < QUIZ_SIZE:
        raise ValueError(f"Banque insuffisante : {total} questions publiées, il en faut {QUIZ_SIZE}.")
    rng = seeded_rng(f"daily:{day}")
    gaps = _gap_days(day, planned or {})
    never = 10**6

    def freshness(q: dict) -> int:
        return gaps.get(q["id"], never)

    remaining = dict(DIFFICULTY_TARGET)
    chosen: dict[str, dict] = {}
    kinds = list(DAILY_ORDER)
    rng.shuffle(kinds)  # l'ordre de choix varie : pas toujours le même type servi en premier
    for kind in kinds:
        pool = by_kind[kind]
        if not pool:
            continue
        best = max(freshness(q) for q in pool)
        tier = [q for q in pool if freshness(q) >= min(best, COMFORT_GAP_DAYS)]
        rng.shuffle(tier)
        tier.sort(key=lambda q: -remaining.get(_difficulty(q), 0))  # tri stable : le hasard départage
        pick = tier[0]
        chosen[kind] = pick
        remaining[_difficulty(pick)] = remaining.get(_difficulty(pick), 0) - 1

    if len(chosen) < QUIZ_SIZE:
        taken = {q["id"] for q in chosen.values()}
        spare = [q for kind in DAILY_ORDER for q in by_kind[kind] if q["id"] not in taken]
        rng.shuffle(spare)
        spare.sort(key=lambda q: -freshness(q))
        for kind in DAILY_ORDER:
            if kind not in chosen:
                chosen[kind] = spare.pop(0)
    return [chosen[kind]["id"] for kind in DAILY_ORDER]
