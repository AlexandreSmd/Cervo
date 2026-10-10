"""Configuration lue dans `.env.local` (racine du dépôt) puis dans l'environnement."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
CONTENT_DIR = ROOT / "content" / "questions"

# Les valeurs par défaut fonctionnent en local avec les émulateurs.
DEFAULTS = {
    "APP_ENV": "local",
    "FIREBASE_PROJECT_ID": "demo-cervo-daily",
    "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
    "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
    "ADMIN_EMAILS": "admin@cervo.test",
    "TIMEZONE": "Europe/Paris",
}


def load_env() -> None:
    load_dotenv(ROOT / ".env.local", override=False)
    if os.environ.get("APP_ENV", DEFAULTS["APP_ENV"]) == "local":
        for key, value in DEFAULTS.items():
            os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    app_env: str
    project_id: str
    admin_emails: frozenset[str]
    timezone: str
    cors_origins: list[str] = field(default_factory=list)

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"


def get_settings() -> Settings:
    load_env()
    return Settings(
        app_env=os.environ.get("APP_ENV", "production"),
        project_id=os.environ.get("FIREBASE_PROJECT_ID", DEFAULTS["FIREBASE_PROJECT_ID"]),
        admin_emails=frozenset(e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()),
        timezone=os.environ.get("TIMEZONE", "Europe/Paris"),
        cors_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o],
    )
