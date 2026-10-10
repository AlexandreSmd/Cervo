"""Banque de questions : fichiers JSON du dépôt, validation, cache Firestore, vues.

Une question existe sous trois formes :
- le **document** stocké (format de `domain.models.Question`, plus `created_at`) ;
- la **vue publique** envoyée avant la réponse (`public_view`) : jamais la bonne réponse ;
- la **révélation** envoyée après la réponse (`reveal`) : bonne réponse, explication, source.
"""

from __future__ import annotations

import base64
import json
import threading
import time
import uuid
from pathlib import Path

from pydantic import ValidationError

from ..config import CONTENT_DIR
from ..domain.catalog import (
    ANSWER_FORMATS,
    CATEGORIES,
    DEFAULT_TIME_LIMIT,
    DIFFICULTIES,
    INPUT_FORMATS,
    TYPE_TIME_LIMIT,
    input_format,
    pillar_of,
)
from ..domain.daily import stable_choices
from ..domain.models import Question
from ..domain.scoring import normalize_text
from . import collections as col

PUBLIC_IMAGES = CONTENT_DIR.parents[1] / "web" / "public"

# --- Fichiers du dépôt (content/questions/*.json) -----------------------------------


def load_files(directory: Path = CONTENT_DIR) -> list[dict]:
    """Lit toutes les questions des fichiers JSON (chaque fichier contient une liste)."""
    items: list[dict] = []
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("questions", [])
        for raw in data:
            items.append({**raw, "_file": path.name})
    return items


def validate(raw: dict) -> Question:
    """Valide une question ; génère un identifiant si elle n'en a pas (admin, import CSV)."""
    data = {k: v for k, v in raw.items() if not k.startswith("_")}
    if not data.get("id") and data.get("category"):
        data["id"] = f"{data['category']}-{uuid.uuid4().hex[:8]}".replace("_", "-")
    return Question.model_validate(data)


def _content_key(q: Question) -> str:
    """Empreinte d'une question pour détecter les doublons.

    Deux questions peuvent partager un énoncé générique (« Quel est l'intrus ? », dictées…) :
    on compare donc aussi les photos, les choix, les éléments à mémoriser et le contenu dicté/classé.
    """
    content = [*(i.url for i in q.images), *(q.choices or []), *(q.memorize.items if q.memorize else [])]
    if q.type in ("order", "dictation"):
        content.append(str(q.correct_answer))
    return normalize_text(q.prompt) + "|" + "|".join(normalize_text(c) for c in content)


def check_bank(raws: list[dict]) -> tuple[list[Question], list[str]]:
    """Valide la banque : format, identifiants et contenus en double, images manquantes."""
    errors: list[str] = []
    valid: list[Question] = []
    ids: dict[str, str] = {}
    keys: dict[str, str] = {}
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
        key = _content_key(q)
        if key in keys:
            errors.append(f"{where} : énoncé en double de {keys[key]}")
            continue
        missing = [i.url for i in q.images if i.url.startswith("/questions/") and not (PUBLIC_IMAGES / i.url.lstrip("/")).exists()]
        if missing:
            errors.append(f"{where} : image introuvable {', '.join(missing)}")
            continue
        ids[q.id] = where
        keys[key] = q.id
        valid.append(q)
    return valid, errors


def to_doc(q: Question, created_at: str) -> dict:
    return {**q.model_dump(mode="json"), "created_at": created_at}


# --- Lecture en base, avec cache ---------------------------------------------------
# Toute la banque tient en mémoire (quelques centaines de documents) : on la relit au plus
# toutes les 30 s, et immédiatement après une modification depuis l'admin.

_CACHE_TTL = 30.0
_lock = threading.Lock()
_cache: dict = {"at": 0.0, "project": None, "items": None}


def all_questions(db, force: bool = False) -> list[dict]:
    with _lock:
        fresh = time.monotonic() - _cache["at"] < _CACHE_TTL
        if not force and fresh and _cache["items"] is not None and _cache["project"] == db.project:
            return _cache["items"]
    items = [{**d.to_dict(), "id": d.id} for d in db.collection(col.QUESTIONS).stream()]
    with _lock:
        _cache.update(at=time.monotonic(), items=items, project=db.project)
    return items


def invalidate_cache() -> None:
    with _lock:
        _cache["items"] = None


def by_id(db) -> dict[str, dict]:
    return {q["id"]: q for q in all_questions(db)}


# --- Vues ---------------------------------------------------------------------


def images_of(q: dict) -> list[dict]:
    """Photos d'une question (accepte l'ancien format image_url des données déjà en base)."""
    if q.get("images"):
        return list(q["images"])
    if q.get("image_url"):
        return [{"url": q["image_url"], "alt": q.get("image_alt") or "Illustration", "credit": q.get("image_credit")}]
    return []


def time_limit(q: dict) -> int:
    """Chrono de la question, en secondes."""
    return int(q.get("time_limit") or TYPE_TIME_LIMIT.get(q["type"], DEFAULT_TIME_LIMIT))


def describe(q: dict) -> dict:
    """Libellés lisibles de la structure d'une question (admin)."""
    fmt = input_format(len(images_of(q)))
    return {
        "input_format": fmt,
        "input_label": INPUT_FORMATS[fmt],
        "answer_label": ANSWER_FORMATS.get(q["type"], q["type"]),
        "difficulty_label": DIFFICULTIES.get(q.get("difficulty", 2), ""),
        "category_label": CATEGORIES.get(q["category"], q["category"]),
    }


def public_view(q: dict, position: int) -> dict:
    """Question telle qu'envoyée au joueur AVANT sa réponse : jamais la bonne réponse."""
    cfg = q.get("numeric_config") or {}
    view = {
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
        "memorize": q.get("memorize"),
        "time_limit": time_limit(q),
    }
    if q["type"] == "order":
        # Les éléments sont mélangés (de façon stable) : l'ordre stocké est la réponse.
        view["items"] = stable_choices(q["id"], list(q["correct_answer"]))
    if q["type"] == "size":
        view["size"] = q.get("size_config")
    if q["type"] == "numeric" and cfg.get("input") == "slider":
        view["slider"] = {"min": cfg["min"], "max": cfg["max"], "step": cfg.get("step") or 1}
    if q["type"] == "dictation":
        # Le navigateur doit lire le texte (synthèse vocale) : il est seulement encodé pour ne
        # pas s'afficher en clair. Pas de classement public, donc enjeu de triche faible.
        view["speech"] = base64.b64encode(str(q["correct_answer"]).encode("utf-8")).decode("ascii")
    return view


def reveal(q: dict) -> dict:
    """Ce qu'on montre APRÈS la réponse."""
    return {
        "correct_answer": q["correct_answer"],
        "explanation": q.get("explanation"),
        "source_url": q.get("source_url"),
    }
