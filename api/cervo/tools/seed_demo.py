"""Ajoute 3 semaines d'historique fictif au compte démo (demo@cervo.test)."""

from __future__ import annotations

from firebase_admin import auth

from ..config import get_settings
from ..daily import today_str
from ..firebase import app, db
from ..service import ensure_user, seed_history

DEMO_EMAIL = "demo@cervo.test"


def main() -> None:
    fb = app()
    try:
        user = auth.get_user_by_email(DEMO_EMAIL, app=fb)
    except auth.UserNotFoundError:
        user = auth.create_user(email=DEMO_EMAIL, email_verified=True, display_name="Démo", app=fb)
    client = db()
    ensure_user(client, {"uid": user.uid, "email": DEMO_EMAIL, "firebase": {"sign_in_provider": "password"}})
    created = seed_history(client, user.uid, today_str(get_settings().timezone), days=21, seed="demo")
    print(f"{created} jour(s) d'historique ajouté(s) au compte {DEMO_EMAIL}.")
    print("Connecte-toi avec ce compte via « Outils de dev » > « Connexion démo » pour voir le profil rempli.")


if __name__ == "__main__":
    main()
