"""Mise en ligne de l'API sur Modal (https://modal.com).

Déploiement : `npm run prod:deploy` (voir docs/DEPLOIEMENT.md). Directement :
    uvx --from modal modal deploy modal_app.py

Le secret Modal « vif-prod » fournit la configuration de production :
    APP_ENV=production, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON, ADMIN_EMAILS, TIMEZONE, FIRESTORE_DATABASE
Il est créé (ou mis à jour) par `npm run prod:deploy` à partir de secrets/firebase-admin.json.
"""

import os
from pathlib import Path

import modal

ROOT = Path(__file__).parent

# Conteneurs gardés allumés en permanence (API_WARM_CONTAINERS dans .env.production).
# 0 (défaut) : on ne paie que quand quelqu'un joue, ce qui reste très loin des crédits gratuits
# de Modal. Le réveil après une pause est court grâce à l'instantané mémoire (ci-dessous) et au
# réveil anticipé déclenché par la page dès son ouverture. 1 : jamais d'attente, environ 5 $/mois.
WARM_CONTAINERS = int(os.environ.get("API_WARM_CONTAINERS") or 0)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(
        "fastapi>=0.115",
        "firebase-admin>=6.5",
        "google-cloud-firestore>=2.16",
        "pydantic>=2.7",
        "python-dotenv>=1.0",
        "tzdata>=2024.1",
    )
    # Le code de l'API, copié tel quel (importable sous le nom `cervo`).
    .add_local_dir(ROOT / "api" / "cervo", remote_path="/root/cervo")
)

app = modal.App("vif-api", image=image)


@app.cls(
    secrets=[modal.Secret.from_name("vif-prod")],
    min_containers=WARM_CONTAINERS,
    # Un serveur reste disponible 15 min après sa dernière requête : une partie entière sans réveil.
    scaledown_window=15 * 60,
    timeout=60,
    # Le plus petit serveur possible : l'API attend surtout le réseau, pas le processeur.
    cpu=0.25,
    memory=512,
    # Instantané mémoire pris après les imports (FastAPI, Firebase…) : un réveil repart de là,
    # en une fraction de seconde au lieu de plusieurs.
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=50)
class Api:
    @modal.enter(snap=True)
    def load(self):
        # Aucun accès réseau ici (rien ne doit être figé dans l'instantané) : seulement les imports.
        from cervo.main import app as fastapi_app

        self.app = fastapi_app

    @modal.enter(snap=False)
    def warm(self):
        from cervo.warmup import warm_up_in_background

        warm_up_in_background()

    @modal.asgi_app()
    def api(self):
        return self.app
