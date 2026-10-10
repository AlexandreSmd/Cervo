"""Accès à Firebase (SDK Admin) : Firestore et vérification des jetons Auth.

En local, FIRESTORE_EMULATOR_HOST et FIREBASE_AUTH_EMULATOR_HOST font pointer
le SDK vers les émulateurs, sans aucun identifiant réel.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials
from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore

from .config import get_settings


@lru_cache
def app() -> firebase_admin.App:
    settings = get_settings()
    options = {"projectId": settings.project_id}
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:  # production (secret Modal)
        cred = credentials.Certificate(json.loads(raw))
    elif os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
        cred = _EmulatorCredential()
    else:
        cred = credentials.ApplicationDefault()
    return firebase_admin.initialize_app(cred, options, name="cervo")


class _EmulatorCredential(credentials.Base):
    """Identifiant factice : les émulateurs n'exigent aucune authentification."""

    def get_credential(self):
        return AnonymousCredentials()


@lru_cache
def db() -> firestore.Client:
    # FIRESTORE_PROJECT_ID permet aux tests d'utiliser une base séparée des données de dev.
    project = os.environ.get("FIRESTORE_PROJECT_ID") or get_settings().project_id
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        return firestore.Client(project=project, credentials=AnonymousCredentials())
    return firestore.Client(project=project, credentials=app().credential.get_credential())


def verify_token(token: str) -> dict:
    return auth.verify_id_token(token, app=app())


def auth_client():
    return auth
