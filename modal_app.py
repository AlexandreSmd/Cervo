"""Point d'entrée Modal : mise en ligne de l'API FastAPI (hors MVP local).

Déploiement :
  1. pip install modal && modal setup
  2. Créer le secret « cervo-firebase » avec :
       FIREBASE_SERVICE_ACCOUNT_JSON (contenu JSON du compte de service),
       FIREBASE_PROJECT_ID, ADMIN_EMAILS, APP_ENV=production, TIMEZONE=Europe/Paris
  3. modal deploy modal_app.py
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi>=0.115", "firebase-admin>=6.5", "google-cloud-firestore>=2.16",
        "pydantic>=2.7", "python-dotenv>=1.0", "tzdata>=2024.1",
    )
    .add_local_dir("api/cervo", remote_path="/root/cervo")
)

app = modal.App("cervo-daily-api", image=image)


@app.function(secrets=[modal.Secret.from_name("cervo-firebase")], min_containers=0)
@modal.asgi_app()
def api():
    from cervo.main import app as fastapi_app

    return fastapi_app
