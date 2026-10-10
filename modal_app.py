"""Mise en ligne de l'API sur Modal (https://modal.com).

Déploiement : `npm run prod:deploy` (voir docs/DEPLOIEMENT.md). Directement :
    uvx --from modal modal deploy modal_app.py

Le secret Modal « vif-prod » fournit la configuration de production :
    APP_ENV=production, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON, ADMIN_EMAILS, TIMEZONE, FIRESTORE_DATABASE
Il est créé (ou mis à jour) par `npm run prod:deploy` à partir de secrets/firebase-admin.json.
"""

from pathlib import Path

import modal

ROOT = Path(__file__).parent

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


@app.function(
    secrets=[modal.Secret.from_name("vif-prod")],
    # Aucun conteneur en veille (gratuit) : la première requête après une pause prend 2 à 4 s.
    min_containers=0,
    scaledown_window=15 * 60,
    timeout=60,
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from cervo.main import app as fastapi_app

    return fastapi_app
