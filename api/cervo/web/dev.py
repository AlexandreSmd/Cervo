"""Outils de développement (/api/dev/*) : actifs uniquement si APP_ENV=local."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from firebase_admin import auth as fb_auth
from pydantic import BaseModel

from ..clock import today
from ..config import get_settings
from ..firebase import app as firebase_app
from ..firebase import db
from ..services import demo, play, users
from .deps import AdminClaims, Claims, local_only

router = APIRouter(prefix="/dev", dependencies=[Depends(local_only)])

DEV_ACCOUNTS = {"demo": ("demo@cervo.test", "Démo"), "admin": ("admin@cervo.test", "Admin")}


class DevLoginIn(BaseModel):
    role: Literal["demo", "admin"] = "demo"


@router.post("/login")
def dev_login(body: DevLoginIn):
    """Jeton de connexion pour un compte de test (créé au besoin dans l'émulateur Auth)."""
    email, name = DEV_ACCOUNTS[body.role]
    if body.role == "admin" and get_settings().admin_emails:
        email = sorted(get_settings().admin_emails)[0]
    fb = firebase_app()
    try:
        user = fb_auth.get_user_by_email(email, app=fb)
    except fb_auth.UserNotFoundError:
        user = fb_auth.create_user(email=email, email_verified=True, display_name=name, app=fb)
    token = fb_auth.create_custom_token(user.uid, app=fb)
    return {"token": token.decode() if isinstance(token, bytes) else token, "email": email}


@router.post("/replay-today")
def replay_today(claims: Claims):
    client = db()
    play.attempt_ref(client, claims["uid"], today()).delete()
    play.rebuild_user_stats(client, claims["uid"], today())
    return {"ok": True}


@router.post("/seed-history")
def seed_history(claims: Claims):
    client = db()
    users.ensure_user(client, claims)
    return {"created": demo.seed_history(client, claims["uid"], today())}


@router.post("/simulate-players")
def simulate_players(_: AdminClaims):
    return {"players": demo.simulate_players(db(), today())}
