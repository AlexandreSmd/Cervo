"""Dépendances partagées des routes : authentification, droits, limitation de débit."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from ..config import get_settings
from ..firebase import verify_token


def current_claims(authorization: Annotated[str | None, Header()] = None) -> dict:
    """Jeton Firebase (invité ou compte) vérifié ; `uid` toujours présent."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Connexion requise.")
    try:
        claims = verify_token(authorization.split(" ", 1)[1].strip())
    except Exception:  # jeton expiré, mal formé, mauvais projet…
        raise HTTPException(401, "Session invalide ou expirée.") from None
    claims.setdefault("uid", claims.get("user_id") or claims.get("sub"))
    return claims


def is_admin(claims: dict) -> bool:
    """Admin = e-mail listé dans ADMIN_EMAILS ET vérifié par Firebase (Google ou lien magique).

    Sans la vérification, n'importe qui pourrait se créer un compte avec l'adresse du fondateur.
    """
    email = (claims.get("email") or "").lower()
    return bool(email) and claims.get("email_verified") is True and email in get_settings().admin_emails


def admin_claims(claims: Annotated[dict, Depends(current_claims)]) -> dict:
    if not is_admin(claims):
        raise HTTPException(403, "Réservé aux administrateurs.")
    return claims


def local_only() -> None:
    """Les outils de développement n'existent pas hors APP_ENV=local (404, pas 403)."""
    if not get_settings().is_local:
        raise HTTPException(404, "Introuvable.")


Claims = Annotated[dict, Depends(current_claims)]
AdminClaims = Annotated[dict, Depends(admin_claims)]

# Limitation de débit en mémoire, par joueur. En production, Cloudflare ajoute sa propre règle
# (une instance Modal n'a pas de mémoire partagée avec les autres).
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(key: str, limit: int = 40, window: float = 60.0) -> None:
    now = time.monotonic()
    hits = _hits[key]
    while hits and now - hits[0] > window:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(429, "Trop de requêtes, réessaie dans un instant.")
    hits.append(now)
