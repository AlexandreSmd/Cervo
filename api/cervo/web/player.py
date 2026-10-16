"""Routes du joueur : quiz du jour, réponses, résultats, profil, compte."""

from __future__ import annotations

import contextlib

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from firebase_admin import auth as fb_auth

from .. import APP_NAME
from ..clock import today
from ..config import get_settings
from ..domain.catalog import CATEGORIES, DAILY_ORDER, KINDS, PILLARS
from ..domain.daily import is_valid_day
from ..domain.models import AnswerIn, ClueIn, ReportIn, StartIn, UsernameIn
from ..domain.stats import profile_summary
from ..firebase import app as firebase_app
from ..firebase import db
from ..services import leaderboard, media, play, users
from .deps import Claims, is_admin, rate_limit

router = APIRouter()


def _ensure_today(day: str) -> None:
    if day != today():
        raise HTTPException(409, "Ce quiz n'est plus disponible : un nouveau quiz t'attend.")


@router.get("/health")
def health():
    return {"status": "ok", "app": APP_NAME, "env": get_settings().app_env, "today": today()}


@router.get("/meta")
def meta():
    kinds = [{"key": k, "label": KINDS[k].label, "emoji": KINDS[k].emoji, "pillar": KINDS[k].pillar} for k in DAILY_ORDER]
    return {"app": APP_NAME, "categories": CATEGORIES, "kinds": kinds, "pillars": PILLARS, "today": today()}


@router.get("/today")
def get_today(claims: Claims):
    client, day = db(), today()
    user_snap, attempt_snap = play.read_user_and_attempt(client, claims["uid"], day)
    user = users.ensure_user(client, claims, user_snap)
    return {**play.today_state(client, claims["uid"], day, user, attempt_snap), "is_admin": is_admin(claims)}


@router.post("/question-start")
def post_question_start(body: StartIn, claims: Claims):
    _ensure_today(body.date)
    # Pas de lecture du profil ici : la participation vit dans sa propre sous-collection.
    return play.start_question(db(), claims["uid"], body.date, body.question_id)


@router.post("/clue")
def post_clue(body: ClueIn, claims: Claims):
    rate_limit(f"clue:{claims['uid']}", limit=20)
    _ensure_today(body.date)
    return play.reveal_clue(db(), claims["uid"], body.date, body.question_id)


@router.post("/answer")
def post_answer(body: AnswerIn, claims: Claims):
    rate_limit(f"answer:{claims['uid']}")
    _ensure_today(body.date)
    return play.submit_answer(db(), claims, body.date, body.question_id, body.answer)


@router.get("/results/{day}")
def get_results(day: str, claims: Claims):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    return play.day_detail(db(), claims["uid"], day)


@router.get("/profile")
def get_profile(claims: Claims):
    client = db()
    user = users.ensure_user(client, claims)
    return {
        "uid": claims["uid"],
        "username": user.get("username"),
        "email": user.get("email"),
        "is_anonymous": user.get("is_anonymous", True),
        "is_admin": is_admin(claims),
        "created_at": user.get("created_at"),
        "today": today(),
        **profile_summary(user, play.list_attempts(client, claims["uid"]), today()),
    }


@router.patch("/profile")
def patch_profile(body: UsernameIn, claims: Claims):
    client = db()
    users.ensure_user(client, claims)
    return {"username": users.set_username(client, claims["uid"], body.username)}


@router.get("/profile/days")
def get_days(claims: Claims):
    return {"days": play.played_days(db(), claims["uid"])}


@router.get("/leaderboard")
def get_leaderboard(claims: Claims):
    """Classement du mois en cours, avec ta place et ce que le quiz du jour a changé."""
    return leaderboard.view(db(), claims["uid"], today())


@router.post("/report")
def post_report(body: ReportIn, claims: Claims):
    rate_limit(f"report:{claims['uid']}", limit=10)
    play.report_question(db(), claims["uid"], body.question_id, body.reason)
    return {"ok": True}


@router.delete("/account")
def delete_account(claims: Claims):
    users.delete_account(db(), claims["uid"])
    with contextlib.suppress(fb_auth.UserNotFoundError):  # compte invité déjà supprimé côté Auth
        fb_auth.delete_user(claims["uid"], app=firebase_app())
    return {"ok": True}


@router.get("/media/{media_id}")
def get_media(media_id: str):
    """Photos des questions : publiques, mises en cache un an (identifiant immuable)."""
    if not media_id.isalnum():
        raise HTTPException(404, "Image introuvable.")
    data, content_type = media.load(db(), media_id)
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})
