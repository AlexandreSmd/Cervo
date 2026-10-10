"""Routes de l'espace fondateur (/api/admin/*) : réservées aux e-mails de ADMIN_EMAILS."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from ..clock import now_iso, today
from ..domain.catalog import ANSWER_FORMATS, CATEGORIES, DIFFICULTIES, INPUT_FORMATS
from ..domain.daily import is_valid_day
from ..domain.models import FillIn, ImportIn, MediaIn, ScheduleDayIn, StatusIn
from ..firebase import db
from ..services import bank, insights, media, planning
from ..services import collections as col
from .deps import admin_claims

router = APIRouter(prefix="/admin", dependencies=[Depends(admin_claims)])


def _valid_day(day: str) -> str:
    if not is_valid_day(day):
        raise HTTPException(400, "Date invalide.")
    return day


def _errors(exc: ValidationError) -> list[str]:
    return [f"{'.'.join(map(str, e['loc']))} : {e['msg']}" for e in exc.errors()]


@router.get("/meta")
def admin_meta():
    return {
        "categories": CATEGORIES,
        "input_formats": INPUT_FORMATS,
        "answer_formats": ANSWER_FORMATS,
        "difficulties": DIFFICULTIES,
        "today": today(),
    }


# --- Banque de questions ---------------------------------------------------------


@router.get("/questions")
def list_questions():
    """Toute la banque, avec la structure, les statistiques et les dates d'utilisation."""
    client = db()
    reports: dict[str, int] = {}
    for snap in client.collection(col.REPORTS).stream():
        qid = snap.to_dict().get("question_id")
        reports[qid] = reports.get(qid, 0) + 1
    rates = insights.question_rates(client)
    used = planning.usage(client)
    items = sorted(bank.all_questions(client, force=True), key=lambda q: q.get("created_at") or "", reverse=True)
    legacy = ("image_url", "image_alt", "image_credit")
    return {
        "questions": [
            {
                **{k: v for k, v in q.items() if k not in legacy},
                "images": bank.images_of(q),
                **bank.describe(q),
                "reports": reports.get(q["id"], 0),
                "stats": rates.get(q["id"], insights.rate(None)),
                "days": used.get(q["id"], []),
            }
            for q in items
        ]
    }


@router.post("/questions/import")
def import_questions(body: ImportIn):
    """Crée (ou remplace avec `overwrite`) des questions ; renvoie les erreurs ligne par ligne."""
    client = db()
    existing = {q["id"] for q in bank.all_questions(client, force=True)}
    created, updated, errors = [], [], []
    batch = client.batch()
    for index, raw in enumerate(body.questions):
        try:
            q = bank.validate(raw)
        except ValidationError as exc:
            errors.append({"index": index, "errors": _errors(exc)})
            continue
        if q.id in existing and not body.overwrite:
            errors.append({"index": index, "errors": [f"l'identifiant {q.id} existe déjà"]})
            continue
        batch.set(client.collection(col.QUESTIONS).document(q.id), bank.to_doc(q, now_iso()))
        (updated if q.id in existing else created).append(q.id)
        existing.add(q.id)
    batch.commit()
    bank.bump_version(client)
    return {"created": created, "updated": updated, "errors": errors}


@router.put("/questions/{question_id}")
def update_question(question_id: str, body: dict):
    client = db()
    ref = client.collection(col.QUESTIONS).document(question_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Question introuvable.")
    try:
        q = bank.validate({**body, "id": question_id})
    except ValidationError as exc:
        raise HTTPException(422, _errors(exc)) from None
    ref.set(bank.to_doc(q, snap.to_dict().get("created_at") or now_iso()))
    bank.bump_version(client)
    return {"id": question_id}


@router.patch("/questions/{question_id}")
def set_status(question_id: str, body: StatusIn):
    ref = db().collection(col.QUESTIONS).document(question_id)
    if not ref.get().exists:
        raise HTTPException(404, "Question introuvable.")
    ref.update({"status": body.status})
    bank.bump_version(db())
    return {"id": question_id, "status": body.status}


@router.get("/reports")
def list_reports():
    items = [{**s.to_dict(), "id": s.id} for s in db().collection(col.REPORTS).stream()]
    return {"reports": sorted(items, key=lambda r: r.get("created_at", ""), reverse=True)}


@router.post("/media")
def upload_media(body: MediaIn):
    return {"url": media.save(db(), body.data_url)}


# --- Statistiques -------------------------------------------------------------


@router.get("/overview")
def overview():
    return insights.overview(db(), today())


@router.get("/stats/{day}")
def day_stats(day: str):
    return insights.day_stats(db(), _valid_day(day))


# --- Planning ---------------------------------------------------------------


@router.get("/schedule")
def get_schedule(start: str | None = None, days: int = 28):
    start = start if start and is_valid_day(start) else today()
    return planning.schedule(db(), today(), start, max(1, min(days, 90)))


@router.post("/schedule/fill")
def fill_schedule(body: FillIn):
    return {"created": planning.fill(db(), today(), body.days)}


@router.put("/schedule/{day}")
def set_day(day: str, body: ScheduleDayIn):
    planning.set_day(db(), _valid_day(day), body.question_ids, today())
    return {"date": day, "question_ids": body.question_ids}


@router.post("/schedule/{day}/regenerate")
def regenerate_day(day: str):
    return {"date": day, "question_ids": planning.regenerate_day(db(), _valid_day(day), today())}


@router.delete("/schedule/{day}")
def clear_day(day: str):
    planning.clear_day(db(), _valid_day(day), today())
    return {"date": day}
