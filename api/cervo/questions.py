"""Banque de questions : lecture des fichiers JSON, validation, cache Firestore."""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path

from pydantic import ValidationError

from .catalog import ANSWER_FORMATS, CATEGORIES, DIFFICULTIES, INPUT_FORMATS, input_format, pillar_of
from .config import CONTENT_DIR
from .daily import stable_choices
from .models import Question
from .scoring import normalize_text

_CACHE_TTL = 30.0
_lock = threading.Lock()
_cache: dict = {"at": 0.0, "project": None, "items": None}


def load_files(directory: Path = CONTENT_DIR) -> list[dict]:
    """Lit content/questions/*.json (chaque fichier contient une liste de questions)."""
    items: list[dict] = []
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("questions", [])
        for raw in data:
            raw = dict(raw)
            raw.setdefault("_file", path.name)
            items.append(raw)
    return items


def validate(raw: dict) -> Question:
    data = {k: v for k, v in raw.items() if not k.startswith("_")}
    if not data.get("id") and data.get("category"):
        data["id"] = f"{data['category']}-{uuid.uuid4().hex[:8]}".replace("_", "-")
    return Question.model_validate(data)


def check_bank(raws: list[dict]) -> tuple[list[Question], list[str]]:
    """Valide le format, détecte les identifiants et énoncés en double."""
    errors: list[str] = []
    valid: list[Question] = []
    ids: dict[str, str] = {}
    prompts: dict[str, str] = {}
    for index, raw in enumerate(raws):
        where = f"{raw.get('_file', '?')} #{index + 1} ({raw.get('id', 'sans id')})"
        try:
            q = validate(raw)
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(x) for x in err["loc"]) or "question"
                errors.append(f"{where} : {loc} — {err['msg']}")
            continue
        if q.id in ids:
            errors.append(f"{where} : identifiant en double (déjà dans {ids[q.id]})")
            continue
        key = normalize_text(q.prompt) + "|" + "|".join(normalize_text(i.url) for i in q.images)
        if key in prompts:
            errors.append(f"{where} : énoncé en double de {prompts[key]}")
            continue
        missing = [
            i.url for i in q.images
            if i.url.startswith("/questions/") and not (CONTENT_DIR.parents[1] / "web" / "public" / i.url.lstrip("/")).exists()
        ]
        if missing:
            errors.append(f"{where} : image introuvable {', '.join(missing)}")
            continue
        ids[q.id] = where
        prompts[key] = q.id
        valid.append(q)
    return valid, errors


def to_doc(q: Question, created_at: str) -> dict:
    doc = q.model_dump(mode="json")
    doc["created_at"] = created_at
    return doc


def all_questions(db, force: bool = False) -> list[dict]:
    with _lock:
        fresh = time.monotonic() - _cache["at"] < _CACHE_TTL
        if not force and fresh and _cache["items"] is not None and _cache["project"] == db.project:
            return _cache["items"]
    items = [{**d.to_dict(), "id": d.id} for d in db.collection("questions").stream()]
    with _lock:
        _cache.update(at=time.monotonic(), items=items, project=db.project)
    return items


def invalidate_cache() -> None:
    with _lock:
        _cache["items"] = None


def by_id(db) -> dict[str, dict]:
    return {q["id"]: q for q in all_questions(db)}


def images_of(q: dict) -> list[dict]:
    """Photos d'une question (accepte l'ancien format image_url des données déjà en base)."""
    if q.get("images"):
        return list(q["images"])
    if q.get("image_url"):
        return [{"url": q["image_url"], "alt": q.get("image_alt") or "Illustration", "credit": q.get("image_credit")}]
    return []


def describe(q: dict) -> dict:
    """Libellés lisibles de la structure d'une question (admin)."""
    images = images_of(q)
    fmt = input_format(len(images))
    return {
        "input_format": fmt,
        "input_label": INPUT_FORMATS[fmt],
        "answer_label": ANSWER_FORMATS.get(q["type"], q["type"]),
        "difficulty_label": DIFFICULTIES.get(q.get("difficulty", 2), ""),
        "category_label": CATEGORIES.get(q["category"], q["category"]),
    }


def public_view(q: dict, position: int) -> dict:
    """Question sans la bonne réponse (envoyée avant validation)."""
    cfg = q.get("numeric_config") or {}
    return {
        "id": q["id"],
        "position": position,
        "type": q["type"],
        "category": q["category"],
        "category_label": CATEGORIES.get(q["category"], q["category"]),
        "pillar": pillar_of(q["category"]),
        "difficulty": q.get("difficulty", 2),
        "prompt": q["prompt"],
        "images": images_of(q),
        "choices": stable_choices(q["id"], q["choices"]) if q["type"] == "mcq" and q.get("choices") else None,
        "unit": cfg.get("unit"),
    }


def reveal(q: dict) -> dict:
    """Ce qu'on montre après validation : bonne réponse, explication, source."""
    return {
        "correct_answer": q["correct_answer"],
        "explanation": q.get("explanation"),
        "source_url": q.get("source_url"),
    }
