"""Données fictives pour le développement local (routes /api/dev/*, `npm run db:seed:demo`).

Rien ici n'est utilisé en production : les routes qui l'appellent n'existent que si APP_ENV=local.
"""

from __future__ import annotations

import random
from collections import Counter
from datetime import date, timedelta

from google.cloud import firestore

from ..domain.scoring import day_score, score_answer
from . import bank, quiz
from . import collections as col
from .play import attempt_ref, rebuild_user_stats


def seed_history(db, uid: str, today: str, days: int = 21, seed: str | None = None) -> int:
    """Crée `days` jours de participations fictives avant aujourd'hui, avec une progression."""
    rng = random.Random(seed or uid)
    qs = bank.by_id(db)
    created = 0
    start = date.fromisoformat(today)
    for offset in range(days, 0, -1):
        day = (start - timedelta(days=offset)).isoformat()
        # Quelques jours manqués au début, une série continue sur la dernière semaine.
        if offset > 7 and rng.random() < 0.2:
            continue
        ref = attempt_ref(db, uid, day)
        if ref.get().exists:
            continue
        skill = 0.45 + 0.4 * (days - offset) / days
        answers = []
        for position, qid in enumerate(quiz.question_ids(db, day)):
            q = qs[qid]
            answer = fake_answer(q, skill, rng)
            answers.append(
                {
                    "question_id": qid,
                    "position": position,
                    "user_answer": answer,
                    "score": score_answer(q, answer),
                    "answered_at": f"{day}T08:00:00+00:00",
                    "category": q["category"],
                    "type": q["type"],
                }
            )
        ref.set(
            {
                "date": day,
                "question_ids": [a["question_id"] for a in answers],
                "answers": answers,
                "started_at": f"{day}T08:00:00+00:00",
                "completed_at": f"{day}T08:06:00+00:00",
                "score_total": day_score([a["score"] for a in answers]),
                "demo": True,
            }
        )
        created += 1
    rebuild_user_stats(db, uid)
    return created


def fake_answer(q: dict, skill: float, rng: random.Random):
    """Réponse plausible : juste avec la probabilité `skill`, sinon une erreur typique."""
    correct = q["correct_answer"]
    good = rng.random() < skill
    match q["type"]:
        case "binary":
            return correct if good else not correct
        case "mcq":
            return correct if good else rng.choice([c for c in q["choices"] if c != correct])
        case "short_text":
            return str(correct) if good else "je ne sais pas"
        case "dictation":
            words = str(correct).split()
            return str(correct) if good else " ".join(words[: max(1, len(words) - 2)])
        case "order":
            items = list(correct)
            if not good:
                items[0], items[-1] = items[-1], items[0]
            return items
        case "size":
            return round(float(correct) * (1 if good else rng.uniform(0.5, 1.8)), 2)
    value = float(correct)
    cfg = q.get("numeric_config") or {}
    if cfg.get("scale") == "log":
        spread = (cfg.get("factor") or 3) ** ((1 - skill) * rng.uniform(0, 1.6))
        value = value * spread if rng.random() < 0.5 else value / spread
    else:
        tolerance = cfg.get("tolerance") or max(abs(value) * 0.1, 1)
        value = value + rng.uniform(-1, 1) * tolerance * (1.2 - skill)
    return round(value, 2) if abs(value) < 100 else round(value)


def simulate_players(db, today: str, days: int = 14) -> int:
    """Remplit le tableau de bord avec des joueurs fictifs (agrégats seulement, pas de comptes)."""
    qs = bank.by_id(db)
    rng = random.Random(f"simulate:{today}")
    total = 0
    for offset in range(days, -1, -1):
        day = (date.fromisoformat(today) - timedelta(days=offset)).isoformat()
        ids = quiz.question_ids(db, day)
        players = rng.randint(25, 90) + (days - offset) * 3
        completed = int(players * rng.uniform(0.78, 0.95))
        per_question = {}
        for qid in ids:
            q = qs[qid]
            base = {1: 0.8, 2: 0.6, 3: 0.4}[int(q.get("difficulty", 2))]
            correct = int(completed * min(0.97, max(0.05, rng.gauss(base, 0.12))))
            partial = int((completed - correct) * rng.uniform(20, 60)) if q["type"] in ("numeric", "size", "order", "dictation") else 0
            per_question[qid] = {"sum": correct * 100 + partial, "count": completed, "correct": correct}
        average = sum(v["sum"] for v in per_question.values()) / (10 * completed) if completed else 0
        buckets: Counter = Counter()
        score_sum = 0
        for _ in range(completed):
            s = max(0, min(100, int(rng.gauss(average, 14))))
            buckets[str(min(9, s // 10))] += 1
            score_sum += s
        db.collection(col.DAILY_STATS).document(day).set(
            {
                "date": day,
                "started": players,
                "completed": completed,
                "score_sum": score_sum,
                "buckets": dict(buckets),
                "questions": per_question,
                "simulated": True,
            }
        )
        inc = firestore.Increment
        for qid, v in per_question.items():
            db.collection(col.QUESTION_STATS).document(qid).set(
                {"sum": inc(v["sum"]), "count": inc(v["count"]), "correct": inc(v["correct"])}, merge=True
            )
        total += players
    return total
