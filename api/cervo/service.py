"""Logique applicative qui touche Firestore (quiz du jour, participations, profil)."""

from __future__ import annotations

import random
from datetime import datetime, timezone

from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore

from . import questions as bank
from .daily import QUIZ_SIZE, build_daily_quiz
from .scoring import day_score, score_answer
from .stats import apply_answer, apply_completion, displayed_streak, empty_stats, recompute

HISTORY_DAYS = 365


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --- Quiz du jour -----------------------------------------------------------

def planned_days(db) -> dict[str, list[str]]:
    return {d.id: list(d.to_dict().get("question_ids", [])) for d in db.collection("daily_quizzes").stream()}


def history_around(day: str, planned: dict[str, list[str]]) -> list[list[str]]:
    """Questions des autres jours (passés et déjà planifiés), du plus proche au plus lointain."""
    from datetime import date as _date

    target = _date.fromisoformat(day)
    others = sorted((d for d in planned if d != day), key=lambda d: abs((_date.fromisoformat(d) - target).days))
    return [planned[d] for d in others[:HISTORY_DAYS]]


def compute_day(db, day: str, planned: dict[str, list[str]] | None = None) -> list[str]:
    planned = planned if planned is not None else planned_days(db)
    return build_daily_quiz(day, bank.all_questions(db), history_around(day, planned))


def daily_question_ids(db, day: str) -> list[str]:
    """Quiz du jour : celui planifié par l'admin, sinon calculé de façon déterministe puis figé."""
    ref = db.collection("daily_quizzes").document(day)
    snap = ref.get()
    if snap.exists:
        return list(snap.to_dict()["question_ids"])
    ids = compute_day(db, day)
    try:
        ref.create({"question_ids": ids, "created_at": now_iso(), "source": "auto"})
    except AlreadyExists:
        return list(ref.get().to_dict()["question_ids"])
    return ids


# --- Utilisateurs -----------------------------------------------------------

def _default_username(uid: str) -> str:
    return f"Cervo-{uid[:5].upper()}"


def ensure_user(db, claims: dict) -> dict:
    uid = claims["uid"]
    ref = db.collection("users").document(uid)
    snap = ref.get()
    is_anonymous = claims.get("firebase", {}).get("sign_in_provider") == "anonymous"
    email = claims.get("email")
    if not snap.exists:
        username = _default_username(uid)
        doc = {
            "username": username,
            "username_lower": username.lower(),
            "email": email,
            "is_anonymous": is_anonymous,
            "created_at": now_iso(),
            **empty_stats(),
        }
        ref.set(doc)
        db.collection("usernames").document(username.lower()).set({"uid": uid})
        return doc
    doc = snap.to_dict()
    if doc.get("is_anonymous") != is_anonymous or doc.get("email") != email:
        ref.update({"is_anonymous": is_anonymous, "email": email})
        doc.update(is_anonymous=is_anonymous, email=email)
    return doc


def set_username(db, uid: str, username: str) -> str:
    lower = username.lower()
    user_ref = db.collection("users").document(uid)
    new_ref = db.collection("usernames").document(lower)

    @firestore.transactional
    def run(tx):
        user = user_ref.get(transaction=tx).to_dict() or {}
        taken = new_ref.get(transaction=tx)
        if taken.exists and taken.to_dict().get("uid") != uid:
            raise ApiError(409, "Ce pseudo est déjà pris.")
        old = user.get("username_lower")
        if old and old != lower:
            tx.delete(db.collection("usernames").document(old))
        tx.set(new_ref, {"uid": uid})
        tx.update(user_ref, {"username": username, "username_lower": lower})

    run(db.transaction())
    return username


# --- Participation ----------------------------------------------------------

def attempt_ref(db, uid: str, day: str):
    return db.collection("users").document(uid).collection("attempts").document(day)


def today_payload(db, uid: str, day: str, user: dict) -> dict:
    ids = daily_question_ids(db, day)
    qs = bank.by_id(db)
    snap = attempt_ref(db, uid, day).get()
    attempt = snap.to_dict() if snap.exists else None
    answers = []
    for ans in (attempt or {}).get("answers", []):
        q = qs.get(ans["question_id"])
        answers.append({**_answer_view(ans), **(bank.reveal(q) if q else {})})
    return {
        "date": day,
        "questions": [bank.public_view(qs[qid], i) for i, qid in enumerate(ids) if qid in qs],
        "answers": answers,
        "completed": bool(attempt and attempt.get("completed_at")),
        "score_total": attempt.get("score_total") if attempt else None,
        "streak": displayed_streak(user, day),
        "username": user.get("username"),
    }


def _answer_view(ans: dict) -> dict:
    return {
        "question_id": ans["question_id"],
        "position": ans["position"],
        "user_answer": ans.get("user_answer"),
        "score": ans["score"],
    }


def submit_answer(db, uid: str, day: str, question_id: str, answer) -> dict:
    ids = daily_question_ids(db, day)
    qs = bank.by_id(db)
    if question_id not in ids:
        raise ApiError(400, "Cette question ne fait pas partie du quiz du jour.")
    question = qs.get(question_id)
    if not question:
        raise ApiError(404, "Question introuvable.")
    a_ref = attempt_ref(db, uid, day)
    u_ref = db.collection("users").document(uid)

    @firestore.transactional
    def run(tx):
        a_snap = a_ref.get(transaction=tx)
        u_snap = u_ref.get(transaction=tx)
        attempt = a_snap.to_dict() if a_snap.exists else {
            "date": day, "question_ids": ids, "answers": [], "started_at": now_iso(),
            "completed_at": None, "score_total": None,
        }
        answers = list(attempt.get("answers", []))
        position = len(answers)
        if position >= QUIZ_SIZE or attempt.get("completed_at"):
            raise ApiError(409, "Tu as déjà terminé le quiz du jour. Reviens demain !")
        if ids[position] != question_id:
            raise ApiError(409, "Cette question a déjà été validée ou n'est pas la suivante.")
        score = score_answer(question, answer)
        answers.append({
            "question_id": question_id,
            "position": position,
            "user_answer": answer,
            "score": score,
            "answered_at": now_iso(),
            "category": question["category"],
            "type": question["type"],
        })
        stats = apply_answer(u_snap.to_dict() or empty_stats(), question, score)
        attempt["answers"] = answers
        completed = len(answers) == QUIZ_SIZE
        if completed:
            attempt["score_total"] = day_score([a["score"] for a in answers])
            attempt["completed_at"] = now_iso()
            stats = apply_completion(stats, day, attempt["score_total"])
        tx.set(a_ref, attempt)
        tx.set(u_ref, {k: stats[k] for k in empty_stats()}, merge=True)
        record_stats(tx, db, day, question_id, score, position, attempt.get("score_total") if completed else None)
        return score, position, completed, attempt.get("score_total"), stats

    score, position, completed, total, stats = run(db.transaction())
    return {
        "question_id": question_id,
        "position": position,
        "user_answer": answer,
        "score": score,
        **bank.reveal(question),
        "completed": completed,
        "score_total": total,
        "streak": displayed_streak(stats, day),
    }


def record_stats(tx, db, day: str, question_id: str, score: int, position: int, day_total: int | None) -> None:
    """Statistiques agrégées pour le tableau de bord, écrites dans la même transaction."""
    inc = firestore.Increment
    daily = {
        "date": day,
        "questions": {question_id: {"sum": inc(score), "count": inc(1), "correct": inc(1 if score >= 100 else 0)}},
    }
    if position == 0:
        daily["started"] = inc(1)
    if day_total is not None:
        daily["completed"] = inc(1)
        daily["score_sum"] = inc(day_total)
        daily["buckets"] = {str(min(9, day_total // 10)): inc(1)}
    tx.set(db.collection("daily_stats").document(day), daily, merge=True)
    tx.set(db.collection("question_stats").document(question_id),
           {"sum": inc(score), "count": inc(1), "correct": inc(1 if score >= 100 else 0)}, merge=True)


def day_detail(db, uid: str, day: str) -> dict:
    snap = attempt_ref(db, uid, day).get()
    if not snap.exists:
        raise ApiError(404, "Aucune participation ce jour-là.")
    attempt = snap.to_dict()
    if not attempt.get("completed_at"):
        raise ApiError(409, "Ce quiz n'est pas encore terminé.")
    qs = bank.by_id(db)
    items = []
    for ans in attempt["answers"]:
        q = qs.get(ans["question_id"])
        if not q:
            continue
        items.append({
            **bank.public_view(q, ans["position"]),
            **bank.reveal(q),
            **_answer_view(ans),
        })
    return {"date": day, "score_total": attempt["score_total"], "completed_at": attempt["completed_at"], "items": items}


def list_attempts(db, uid: str) -> list[dict]:
    out = []
    for snap in db.collection("users").document(uid).collection("attempts").stream():
        data = snap.to_dict()
        data["date"] = snap.id
        out.append(data)
    out.sort(key=lambda a: a["date"])
    return out


def days_payload(db, uid: str) -> list[dict]:
    qs = bank.by_id(db)
    days = []
    for attempt in list_attempts(db, uid):
        if not attempt.get("completed_at"):
            continue
        answers = []
        for ans in attempt.get("answers", []):
            q = qs.get(ans["question_id"], {})
            answers.append({
                **_answer_view(ans),
                "category": ans.get("category") or q.get("category"),
                "type": ans.get("type") or q.get("type"),
                "prompt": q.get("prompt"),
                "correct_answer": q.get("correct_answer"),
                "unit": (q.get("numeric_config") or {}).get("unit"),
            })
        days.append({"date": attempt["date"], "score_total": attempt["score_total"], "answers": answers})
    days.sort(key=lambda d: d["date"], reverse=True)
    return days


def rebuild_user_stats(db, uid: str) -> dict:
    stats = recompute(list_attempts(db, uid), bank.by_id(db))
    db.collection("users").document(uid).set(stats, merge=True)
    return stats


# --- Signalements et compte -------------------------------------------------

def report_question(db, uid: str, question_id: str, reason: str) -> None:
    if question_id not in bank.by_id(db):
        raise ApiError(404, "Question introuvable.")
    db.collection("reports").add({
        "question_id": question_id, "uid": uid, "reason": reason, "created_at": now_iso(), "status": "open",
    })


def delete_account(db, uid: str) -> None:
    user_ref = db.collection("users").document(uid)
    for snap in user_ref.collection("attempts").stream():
        snap.reference.delete()
    user = user_ref.get().to_dict() or {}
    if user.get("username_lower"):
        db.collection("usernames").document(user["username_lower"]).delete()
    for snap in db.collection("reports").where(filter=firestore.FieldFilter("uid", "==", uid)).stream():
        snap.reference.delete()
    user_ref.delete()


# --- Historique fictif (outils de dev) --------------------------------------

def seed_history(db, uid: str, today: str, days: int = 21, seed: str | None = None) -> int:
    """Crée `days` jours de participations fictives avant aujourd'hui, avec une progression."""
    from datetime import date, timedelta

    from .scoring import parse_number

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
        for position, qid in enumerate(daily_question_ids(db, day)):
            q = qs[qid]
            answer = _fake_answer(q, skill, rng, parse_number)
            answers.append({
                "question_id": qid, "position": position, "user_answer": answer,
                "score": score_answer(q, answer), "answered_at": f"{day}T08:00:00+00:00",
                "category": q["category"], "type": q["type"],
            })
        ref.set({
            "date": day, "question_ids": [a["question_id"] for a in answers], "answers": answers,
            "started_at": f"{day}T08:00:00+00:00", "completed_at": f"{day}T08:06:00+00:00",
            "score_total": day_score([a["score"] for a in answers]), "demo": True,
        })
        created += 1
    rebuild_user_stats(db, uid)
    return created


def _fake_answer(q: dict, skill: float, rng: random.Random, parse_number):
    correct = q["correct_answer"]
    good = rng.random() < skill
    if q["type"] == "binary":
        return correct if good else not correct
    if q["type"] == "mcq":
        return correct if good else rng.choice([c for c in q["choices"] if c != correct])
    if q["type"] == "short_text":
        return str(correct) if good else "je ne sais pas"
    value = float(correct)
    cfg = q.get("numeric_config") or {}
    if cfg.get("scale") == "log":
        spread = (cfg.get("factor") or 3) ** ((1 - skill) * rng.uniform(0, 1.6))
        value = value * spread if rng.random() < 0.5 else value / spread
    else:
        tol = cfg.get("tolerance") or max(abs(value) * 0.1, 1)
        value = value + rng.uniform(-1, 1) * tol * (1.2 - skill)
    return round(value, 2) if abs(value) < 100 else round(value)
