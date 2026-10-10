"""API FastAPI de Cervo Daily (préfixe /api)."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from firebase_admin import auth as fb_auth
from pydantic import BaseModel, ValidationError

from . import APP_NAME, admin, service
from . import questions as bank
from .catalog import ANSWER_FORMATS, CATEGORIES, DIFFICULTIES, INPUT_FORMATS, PILLARS
from .config import get_settings
from .daily import is_valid_day, today_str
from .firebase import app as firebase_app
from .firebase import db, verify_token
from .models import AnswerIn, FillIn, ImportIn, MediaIn, ReportIn, ScheduleDayIn, StatusIn, UsernameIn
from .service import ApiError
from .stats import profile_summary

settings = get_settings()
api = FastAPI(title=f"{APP_NAME} API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
if settings.cors_origins:
    api.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"],
    )


@api.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


router = APIRouter(prefix="/api")


def today() -> str:
    return today_str(get_settings().timezone)


# --- Authentification --------------------------------------------------------

def current_claims(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Connexion requise.")
    try:
        claims = verify_token(authorization.split(" ", 1)[1].strip())
    except Exception:
        raise HTTPException(401, "Session invalide ou expirée.") from None
    claims.setdefault("uid", claims.get("user_id") or claims.get("sub"))
    return claims


def is_admin(claims: dict) -> bool:
    email = (claims.get("email") or "").lower()
    return bool(email) and email in get_settings().admin_emails


def admin_claims(claims: dict = Depends(current_claims)) -> dict:
    if not is_admin(claims):
        raise HTTPException(403, "Réservé aux administrateurs.")
    return claims


def local_only() -> None:
    if not get_settings().is_local:
        raise HTTPException(404, "Introuvable.")


# Limitation de débit simple (en production, Cloudflare s'en charge aussi).
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(key: str, limit: int = 40, window: float = 60.0) -> None:
    now = time.monotonic()
    hits = _hits[key]
    while hits and now - hits[0] > window:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(429, "Trop de requêtes, réessaie dans un instant.")
    hits.append(now)


# --- Routes publiques --------------------------------------------------------

@router.get("/health")
def health():
    return {"status": "ok", "app": APP_NAME, "env": get_settings().app_env, "today": today()}


@router.get("/meta")
def meta():
    return {"app": APP_NAME, "categories": CATEGORIES, "pillars": PILLARS, "today": today()}


@router.get("/today")
def get_today(claims: dict = Depends(current_claims)):
    client = db()
    user = service.ensure_user(client, claims)
    payload = service.today_payload(client, claims["uid"], today(), user)
    payload["is_admin"] = is_admin(claims)
    return payload


@router.post("/answer")
def post_answer(body: AnswerIn, claims: dict = Depends(current_claims)):
    rate_limit(f"answer:{claims['uid']}")
    if body.date != today():
        raise HTTPException(409, "Ce quiz n'est plus disponible : un nouveau quiz t'attend.")
    client = db()
    service.ensure_user(client, claims)
    return service.submit_answer(client, claims["uid"], body.date, body.question_id, body.answer)


@router.get("/results/{day}")
def get_results(day: str, claims: dict = Depends(current_claims)):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    return service.day_detail(db(), claims["uid"], day)


@router.get("/profile")
def get_profile(claims: dict = Depends(current_claims)):
    client = db()
    user = service.ensure_user(client, claims)
    attempts = service.list_attempts(client, claims["uid"])
    return {
        "uid": claims["uid"],
        "username": user.get("username"),
        "email": user.get("email"),
        "is_anonymous": user.get("is_anonymous", True),
        "is_admin": is_admin(claims),
        "created_at": user.get("created_at"),
        "today": today(),
        **profile_summary(user, attempts, today()),
    }


@router.patch("/profile")
def patch_profile(body: UsernameIn, claims: dict = Depends(current_claims)):
    client = db()
    service.ensure_user(client, claims)
    return {"username": service.set_username(client, claims["uid"], body.username)}


@router.get("/profile/days")
def get_days(claims: dict = Depends(current_claims)):
    return {"days": service.days_payload(db(), claims["uid"])}


@router.post("/report")
def post_report(body: ReportIn, claims: dict = Depends(current_claims)):
    rate_limit(f"report:{claims['uid']}", limit=10)
    service.report_question(db(), claims["uid"], body.question_id, body.reason)
    return {"ok": True}


@router.delete("/account")
def delete_account(claims: dict = Depends(current_claims)):
    service.delete_account(db(), claims["uid"])
    try:
        fb_auth.delete_user(claims["uid"], app=firebase_app())
    except fb_auth.UserNotFoundError:
        pass
    return {"ok": True}


# --- Admin -------------------------------------------------------------------

@router.get("/admin/questions")
def admin_questions(_: dict = Depends(admin_claims)):
    client = db()
    reports: dict[str, int] = {}
    for snap in client.collection("reports").stream():
        qid = snap.to_dict().get("question_id")
        reports[qid] = reports.get(qid, 0) + 1
    q_stats = {s.id: admin._rate(s.to_dict()) for s in client.collection("question_stats").stream()}
    used: dict[str, list[str]] = {}
    for day, ids in service.planned_days(client).items():
        for qid in ids:
            used.setdefault(qid, []).append(day)
    items = sorted(bank.all_questions(client, force=True), key=lambda q: q.get("created_at") or "", reverse=True)
    return {"questions": [
        {
            **{k: v for k, v in q.items() if k not in ("image_url", "image_alt", "image_credit")},
            "images": bank.images_of(q),
            **bank.describe(q),
            "reports": reports.get(q["id"], 0),
            "stats": q_stats.get(q["id"], admin._rate(None)),
            "days": sorted(used.get(q["id"], [])),
        }
        for q in items
    ]}


@router.get("/admin/meta")
def admin_meta(_: dict = Depends(admin_claims)):
    return {
        "categories": CATEGORIES, "input_formats": INPUT_FORMATS, "answer_formats": ANSWER_FORMATS,
        "difficulties": DIFFICULTIES, "today": today(),
    }


@router.put("/admin/questions/{question_id}")
def admin_update_question(question_id: str, body: dict, _: dict = Depends(admin_claims)):
    client = db()
    ref = client.collection("questions").document(question_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Question introuvable.")
    try:
        q = bank.validate({**body, "id": question_id})
    except ValidationError as exc:
        raise HTTPException(422, [f"{'.'.join(map(str, e['loc']))} : {e['msg']}" for e in exc.errors()]) from None
    ref.set(bank.to_doc(q, snap.to_dict().get("created_at") or service.now_iso()))
    bank.invalidate_cache()
    return {"id": question_id}


@router.get("/admin/overview")
def admin_overview(_: dict = Depends(admin_claims)):
    return admin.overview(db(), today())


@router.get("/admin/stats/{day}")
def admin_day_stats(day: str, _: dict = Depends(admin_claims)):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    client = db()
    snap = client.collection("daily_stats").document(day).get()
    return admin.day_stats_view(client, day, snap.to_dict() if snap.exists else None, bank.by_id(client))


@router.get("/admin/schedule")
def admin_schedule(start: str | None = None, days: int = 28, _: dict = Depends(admin_claims)):
    start = start if start and is_valid_day(start) else today()
    return admin.schedule(db(), today(), start, max(1, min(days, 90)))


@router.post("/admin/schedule/fill")
def admin_fill(body: FillIn, _: dict = Depends(admin_claims)):
    return {"created": admin.fill_schedule(db(), today(), body.days)}


@router.put("/admin/schedule/{day}")
def admin_set_day(day: str, body: ScheduleDayIn, _: dict = Depends(admin_claims)):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    admin.set_day(db(), day, body.question_ids, today())
    return {"date": day, "question_ids": body.question_ids}


@router.post("/admin/schedule/{day}/regenerate")
def admin_regenerate(day: str, _: dict = Depends(admin_claims)):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    return {"date": day, "question_ids": admin.regenerate_day(db(), day, today())}


@router.delete("/admin/schedule/{day}")
def admin_clear_day(day: str, _: dict = Depends(admin_claims)):
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    admin.clear_day(db(), day, today())
    return {"date": day}


@router.post("/admin/media")
def admin_media(body: MediaIn, _: dict = Depends(admin_claims)):
    return {"url": admin.save_media(db(), body.data_url)}


@router.get("/media/{media_id}")
def get_media(media_id: str):
    if not media_id.isalnum():
        raise HTTPException(404, "Image introuvable.")
    data, content_type = admin.load_media(db(), media_id)
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/admin/reports")
def admin_reports(_: dict = Depends(admin_claims)):
    items = [{**s.to_dict(), "id": s.id} for s in db().collection("reports").stream()]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return {"reports": items}


@router.post("/admin/questions/import")
def admin_import(body: ImportIn, _: dict = Depends(admin_claims)):
    client = db()
    existing = {q["id"] for q in bank.all_questions(client, force=True)}
    created, updated, errors = [], [], []
    batch = client.batch()
    for index, raw in enumerate(body.questions):
        try:
            q = bank.validate(raw)
        except ValidationError as exc:
            errors.append({"index": index, "errors": [f"{'.'.join(map(str, e['loc']))} : {e['msg']}" for e in exc.errors()]})
            continue
        if q.id in existing and not body.overwrite:
            errors.append({"index": index, "errors": [f"l'identifiant {q.id} existe déjà"]})
            continue
        batch.set(client.collection("questions").document(q.id), bank.to_doc(q, service.now_iso()))
        (updated if q.id in existing else created).append(q.id)
        existing.add(q.id)
    batch.commit()
    bank.invalidate_cache()
    return {"created": created, "updated": updated, "errors": errors}


@router.patch("/admin/questions/{question_id}")
def admin_status(question_id: str, body: StatusIn, _: dict = Depends(admin_claims)):
    client = db()
    ref = client.collection("questions").document(question_id)
    if not ref.get().exists:
        raise HTTPException(404, "Question introuvable.")
    ref.update({"status": body.status})
    bank.invalidate_cache()
    return {"id": question_id, "status": body.status}


# --- Outils de développement (APP_ENV=local uniquement) ---------------------

class DevLoginIn(BaseModel):
    role: str = "demo"


DEV_ACCOUNTS = {"demo": ("demo@cervo.test", "Démo"), "admin": ("admin@cervo.test", "Admin")}


@router.post("/dev/login", dependencies=[Depends(local_only)])
def dev_login(body: DevLoginIn):
    email, name = DEV_ACCOUNTS.get(body.role, DEV_ACCOUNTS["demo"])
    if body.role == "admin" and get_settings().admin_emails:
        email = sorted(get_settings().admin_emails)[0]
    fb = firebase_app()
    try:
        user = fb_auth.get_user_by_email(email, app=fb)
    except fb_auth.UserNotFoundError:
        user = fb_auth.create_user(email=email, email_verified=True, display_name=name, app=fb)
    token = fb_auth.create_custom_token(user.uid, app=fb)
    return {"token": token.decode() if isinstance(token, bytes) else token, "email": email}


@router.post("/dev/replay-today", dependencies=[Depends(local_only)])
def dev_replay(claims: dict = Depends(current_claims)):
    client = db()
    service.attempt_ref(client, claims["uid"], today()).delete()
    service.rebuild_user_stats(client, claims["uid"])
    return {"ok": True}


@router.post("/dev/simulate-players", dependencies=[Depends(local_only)])
def dev_simulate(_: dict = Depends(admin_claims)):
    return {"players": admin.simulate_players(db(), today())}


@router.post("/dev/seed-history", dependencies=[Depends(local_only)])
def dev_seed_history(claims: dict = Depends(current_claims)):
    client = db()
    service.ensure_user(client, claims)
    return {"created": service.seed_history(client, claims["uid"], today())}


api.include_router(router)
app = api
