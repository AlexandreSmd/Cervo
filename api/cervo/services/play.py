"""Partie d'un joueur : état du jour, chrono, réponses, résultats, historique.

Règles garanties côté serveur (le navigateur n'est jamais cru sur parole) :
- une seule participation par jour : `users/{uid}/attempts/{date}` ;
- on répond dans l'ordre, sans revenir en arrière ;
- le score est calculé ici, la bonne réponse n'est révélée qu'après la réponse ;
- le chrono démarre ici : une réponse hors délai vaut 0, recharger ne le relance pas.
"""

from __future__ import annotations

from google.cloud import firestore

from ..clock import now_iso, seconds_since
from ..domain.catalog import TIME_GRACE
from ..domain.community import day_community, question_community
from ..domain.daily import QUIZ_SIZE
from ..domain.scoring import day_score, score_answer
from ..domain.stats import apply_answer, apply_completion, displayed_streak, empty_stats, recompute
from ..errors import ApiError
from . import bank, quiz
from . import collections as col
from .users import new_user_doc, user_ref


def attempt_ref(db, uid: str, day: str):
    return user_ref(db, uid).collection(col.ATTEMPTS).document(day)


def _new_attempt(day: str, ids: list[str]) -> dict:
    return {"date": day, "question_ids": ids, "answers": [], "started_at": now_iso(), "completed_at": None, "score_total": None}


def _answer_view(ans: dict) -> dict:
    view = {
        "question_id": ans["question_id"],
        "position": ans["position"],
        "user_answer": ans.get("user_answer"),
        "score": ans["score"],
        "timed_out": ans.get("timed_out", False),
    }
    if ans.get("clues_seen"):
        view["clues_seen"] = ans["clues_seen"]
    return view


def _is_current(current: dict, position: int, question_id: str | None) -> bool:
    """Le chrono enregistré concerne-t-il bien cette question ? (Une question supprimée par
    l'admin en cours de journée est remplacée : l'ancien chrono ne compte plus.)"""
    return current.get("position") == position and (question_id is None or current.get("question_id") in (None, question_id))


def _clues_seen(current: dict, position: int, question_id: str | None = None) -> int:
    """Indices de devinette dévoilés pour la question en cours (le premier est offert)."""
    return int(current.get("clues", 1)) if _is_current(current, position, question_id) else 1


def read_user_and_attempt(db, uid: str, day: str):
    """Profil et participation du jour en une seule lecture groupée (un aller-retour réseau)."""
    u_ref, a_ref = user_ref(db, uid), attempt_ref(db, uid, day)
    snaps = {s.reference.path: s for s in db.get_all([u_ref, a_ref])}
    return snaps[u_ref.path], snaps[a_ref.path]


def today_state(db, uid: str, day: str, user: dict, attempt_snap=None) -> dict:
    """Tout ce qu'il faut pour afficher (ou reprendre) le quiz du jour."""
    ids = quiz.question_ids(db, day)
    qs = bank.by_id(db)
    snap = attempt_snap if attempt_snap is not None else attempt_ref(db, uid, day).get()
    attempt = snap.to_dict() if snap.exists else {}
    answers = [
        {**_answer_view(a), **(bank.reveal(qs[a["question_id"]]) if a["question_id"] in qs else {})} for a in attempt.get("answers", [])
    ]
    current = attempt.get("current") or {}
    return {
        "date": day,
        "server_time": now_iso(),
        # Chrono déjà lancé pour la question en cours (reprise après rechargement).
        "current": current if _is_current(current, len(answers), ids[len(answers)] if len(answers) < len(ids) else None) else None,
        "questions": [bank.public_view(qs[qid], i, _clues_seen(current, i, qid)) for i, qid in enumerate(ids) if qid in qs],
        "answers": answers,
        "completed": bool(attempt.get("completed_at")),
        "score_total": attempt.get("score_total"),
        "streak": displayed_streak(user, day),
        "username": user.get("username"),
    }


def start_question(db, uid: str, day: str, question_id: str) -> dict:
    """Démarre le chrono de la question en cours (idempotent : un second appel ne le relance pas)."""
    ids = quiz.question_ids(db, day)
    ref = attempt_ref(db, uid, day)

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        attempt = snap.to_dict() if snap.exists else _new_attempt(day, ids)
        position = len(attempt.get("answers", []))
        if position >= len(ids) or ids[position] != question_id:
            raise ApiError(409, "Cette question n'est pas la suivante.")
        current = attempt.get("current") or {}
        if not _is_current(current, position, question_id):
            current = {"position": position, "question_id": question_id, "started_at": now_iso(), "clues": 1}
            attempt["current"] = current
            tx.set(ref, attempt)
            if not snap.exists:
                # Premier pas du joueur aujourd'hui : il compte comme « a commencé » (et la journée se
                # verrouille dans le planning).
                tx.set(db.collection(col.DAILY_STATS).document(day), {"date": day, "started": firestore.Increment(1)}, merge=True)
        return current

    return {**run(db.transaction()), "server_time": now_iso()}


def reveal_clue(db, uid: str, day: str, question_id: str) -> dict:
    """Devinette : dévoile l'indice suivant de la question en cours (chaque indice coûte des points).

    Le nombre d'indices vus est gardé côté serveur : c'est lui qui fixe le score de la réponse.
    """
    ids = quiz.question_ids(db, day)
    question = bank.by_id(db).get(question_id)
    if not question or question["type"] != "riddle":
        raise ApiError(400, "Cette question n'a pas d'indices.")
    clues = list(question.get("clues") or [])
    ref = attempt_ref(db, uid, day)

    @firestore.transactional
    def run(tx):
        snap = ref.get(transaction=tx)
        attempt = snap.to_dict() if snap.exists else {}
        position = len(attempt.get("answers", []))
        current = attempt.get("current") or {}
        if position >= len(ids) or ids[position] != question_id or not _is_current(current, position, question_id):
            raise ApiError(409, "Cette question n'est pas en cours.")
        seen = min(len(clues), int(current.get("clues", 1)) + 1)
        if seen != current.get("clues"):
            attempt["current"] = {**current, "clues": seen}
            tx.set(ref, attempt)
        return seen

    seen = run(db.transaction())
    return {"clues": clues[:seen], "clue_total": len(clues)}


def submit_answer(db, claims: dict, day: str, question_id: str, answer) -> dict:
    """Valide une réponse : score, révélation, agrégats du joueur et du tableau de bord.

    Tout est écrit dans une seule transaction : participation, profil et statistiques
    restent cohérents même si le joueur valide deux fois très vite. Le profil est créé
    dans la même transaction s'il n'existe pas encore (aucune lecture préalable).
    """
    uid = claims["uid"]
    ids = quiz.question_ids(db, day)
    if question_id not in ids:
        raise ApiError(400, "Cette question ne fait pas partie du quiz du jour.")
    question = bank.by_id(db).get(question_id)
    if not question:
        raise ApiError(404, "Question introuvable.")
    a_ref = attempt_ref(db, uid, day)
    u_ref = user_ref(db, uid)

    @firestore.transactional
    def run(tx):
        snaps = {s.reference.path: s for s in tx.get_all([a_ref, u_ref])}
        a_snap, u_snap = snaps[a_ref.path], snaps[u_ref.path]
        attempt = a_snap.to_dict() if a_snap.exists else _new_attempt(day, ids)
        answers = list(attempt.get("answers", []))
        position = len(answers)
        if position >= QUIZ_SIZE or attempt.get("completed_at"):
            raise ApiError(409, "Tu as déjà terminé le quiz du jour. Reviens demain !")
        if ids[position] != question_id:
            raise ApiError(409, "Cette question a déjà été validée ou n'est pas la suivante.")

        current = attempt.pop("current", None) or {}
        on_time = _is_current(current, position, question_id)
        limit = bank.time_limit(question)  # None : question sans chrono (dictée)
        if limit is not None and not on_time:
            # Une question chronométrée se lance d'abord (/question-start) : pas de réponse hors chrono.
            raise ApiError(409, "Cette question n'a pas été lancée.")
        elapsed = seconds_since(current.get("started_at")) if on_time else None
        timed_out = answer is None or (limit is not None and elapsed is not None and elapsed > limit + TIME_GRACE)
        clues_seen = _clues_seen(current, position, question_id)
        score = 0 if timed_out else score_answer(question, answer, clues_seen)
        record = {
            "question_id": question_id,
            "position": position,
            "user_answer": answer,
            "score": score,
            "timed_out": timed_out,
            "answered_at": now_iso(),
            "category": question["category"],
            "type": question["type"],
        }
        if question["type"] == "riddle":
            record["clues_seen"] = clues_seen
        answers.append(record)
        attempt["answers"] = answers

        profile = u_snap.to_dict() if u_snap.exists else None
        stats = apply_answer(profile or empty_stats(), question, score)
        completed = len(answers) == QUIZ_SIZE
        if completed:
            attempt["score_total"] = day_score([a["score"] for a in answers])
            attempt["completed_at"] = now_iso()
            stats = apply_completion(stats, day, attempt["score_total"])

        tx.set(a_ref, attempt)
        if profile is None:  # premier passage de ce joueur : profil complet + pseudo réservé
            doc = new_user_doc(claims)
            tx.set(db.collection(col.USERNAMES).document(doc["username_lower"]), {"uid": uid})
            tx.set(u_ref, {**doc, **{k: stats[k] for k in empty_stats()}})
        else:
            tx.set(u_ref, {k: stats[k] for k in empty_stats()}, merge=True)
        _record_stats(tx, db, day, question_id, score, attempt["score_total"] if completed else None)
        return record, completed, attempt.get("score_total"), stats

    record, completed, total, stats = run(db.transaction())
    # Lu après la transaction (et non dedans) : tous les joueurs écrivent ce document,
    # le verrouiller en lecture ralentirait tout le monde.
    daily = db.collection(col.DAILY_STATS).document(day).get().to_dict() or {}
    return {
        **_answer_view(record),
        **bank.reveal(question),
        "community": question_community((daily.get("questions") or {}).get(question_id)),
        "completed": completed,
        "score_total": total,
        "streak": displayed_streak(stats, day),
    }


def _record_stats(tx, db, day: str, question_id: str, score: int, day_total: int | None) -> None:
    """Agrégats du tableau de bord (incréments atomiques, aucune lecture nécessaire)."""
    inc = firestore.Increment
    per_question = {"sum": inc(score), "count": inc(1), "correct": inc(1 if score >= 100 else 0)}
    daily: dict = {"date": day, "questions": {question_id: per_question}}
    if day_total is not None:
        daily["completed"] = inc(1)
        daily["score_sum"] = inc(day_total)
        daily["buckets"] = {str(min(9, day_total // 10)): inc(1)}  # répartition par tranche de 10
    tx.set(db.collection(col.DAILY_STATS).document(day), daily, merge=True)
    tx.set(db.collection(col.QUESTION_STATS).document(question_id), per_question, merge=True)


def day_detail(db, uid: str, day: str) -> dict:
    """Détail d'une journée terminée : chaque question, ta réponse, la bonne réponse, ton score."""
    snap = attempt_ref(db, uid, day).get()
    if not snap.exists:
        raise ApiError(404, "Aucune participation ce jour-là.")
    attempt = snap.to_dict()
    if not attempt.get("completed_at"):
        raise ApiError(409, "Ce quiz n'est pas encore terminé.")
    qs = bank.by_id(db)
    daily = db.collection(col.DAILY_STATS).document(day).get().to_dict() or {}
    per_question = daily.get("questions") or {}
    items = [
        {
            **bank.public_view(qs[a["question_id"]], a["position"]),
            **bank.reveal(qs[a["question_id"]]),
            **_answer_view(a),
            "community": question_community(per_question.get(a["question_id"])),
        }
        for a in attempt["answers"]
        if a["question_id"] in qs
    ]
    return {
        "date": day,
        "score_total": attempt["score_total"],
        "completed_at": attempt["completed_at"],
        "community": day_community(daily, attempt["score_total"]),
        "items": items,
    }


def list_attempts(db, uid: str) -> list[dict]:
    out = [{**s.to_dict(), "date": s.id} for s in user_ref(db, uid).collection(col.ATTEMPTS).stream()]
    return sorted(out, key=lambda a: a["date"])


def played_days(db, uid: str) -> list[dict]:
    """Journées terminées du joueur, de la plus récente à la plus ancienne (profil)."""
    qs = bank.by_id(db)
    days = []
    for attempt in list_attempts(db, uid):
        if not attempt.get("completed_at"):
            continue
        answers = []
        for a in attempt.get("answers", []):
            q = qs.get(a["question_id"], {})
            answers.append(
                {
                    **_answer_view(a),
                    "category": a.get("category") or q.get("category"),
                    "type": a.get("type") or q.get("type"),
                    "prompt": q.get("prompt"),
                    "correct_answer": q.get("correct_answer"),
                    "unit": (q.get("numeric_config") or {}).get("unit"),
                }
            )
        days.append({"date": attempt["date"], "score_total": attempt["score_total"], "answers": answers})
    return sorted(days, key=lambda d: d["date"], reverse=True)


def rebuild_user_stats(db, uid: str) -> dict:
    """Recalcule les agrégats du joueur depuis ses participations (outils de dev)."""
    stats = recompute(list_attempts(db, uid), bank.by_id(db))
    user_ref(db, uid).set(stats, merge=True)
    return stats


def report_question(db, uid: str, question_id: str, reason: str) -> None:
    if question_id not in bank.by_id(db):
        raise ApiError(404, "Question introuvable.")
    db.collection(col.REPORTS).add({"question_id": question_id, "uid": uid, "reason": reason, "created_at": now_iso(), "status": "open"})
