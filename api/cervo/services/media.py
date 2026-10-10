"""Photos envoyées depuis l'admin.

Stockées dans Firestore (≤ 900 Ko, réduites côté navigateur) et servies par /api/media/{id}
avec un cache long : aucun service de stockage supplémentaire à configurer.
À remplacer par Firebase Storage si les volumes augmentent.
"""

from __future__ import annotations

import base64
import re
import uuid

from ..clock import now_iso
from ..errors import ApiError
from . import collections as col

MAX_BYTES = 900_000
DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp|gif|svg\+xml));base64,(.+)$", re.S)


def save(db, data_url: str) -> str:
    """Enregistre une image reçue en data URL ; renvoie son URL publique."""
    match = DATA_URL.match(data_url)
    if not match:
        raise ApiError(400, "Format d'image non reconnu (PNG, JPEG, WebP, GIF ou SVG).")
    content_type, payload = match.groups()
    try:
        raw = base64.b64decode(payload, validate=True)
    except ValueError:
        raise ApiError(400, "Image illisible.") from None
    if len(raw) > MAX_BYTES:
        raise ApiError(413, "Image trop lourde (900 Ko maximum).")
    media_id = uuid.uuid4().hex[:16]
    db.collection(col.MEDIA).document(media_id).set({"content_type": content_type, "data": raw, "created_at": now_iso()})
    return f"/api/media/{media_id}"


def load(db, media_id: str) -> tuple[bytes, str]:
    snap = db.collection(col.MEDIA).document(media_id).get()
    if not snap.exists:
        raise ApiError(404, "Image introuvable.")
    data = snap.to_dict()
    return bytes(data["data"]), data["content_type"]
