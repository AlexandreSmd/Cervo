"""Point d'entrée ASGI : `uvicorn cervo.main:app` (local) et `modal_app.py` (production)."""

from .web.app import create_app

app = create_app()
