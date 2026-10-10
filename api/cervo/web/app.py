"""Application FastAPI : assemble les routes sous /api et traduit les erreurs métier."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .. import APP_NAME
from ..config import get_settings
from ..errors import ApiError
from . import admin, dev, player


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=f"{APP_NAME} API", version="0.3.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    if settings.cors_origins:  # en production, le Worker Cloudflare sert le site et l'API sur le même domaine
        app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status, content={"detail": exc.message})

    api = APIRouter(prefix="/api")
    api.include_router(player.router)
    api.include_router(admin.router)
    api.include_router(dev.router)
    app.include_router(api)
    return app
