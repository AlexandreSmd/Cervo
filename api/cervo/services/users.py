"""Joueurs : création du profil à la première requête, pseudo unique, suppression (RGPD)."""

from __future__ import annotations

from google.cloud import firestore

from ..clock import now_iso
from ..domain.stats import empty_stats
from ..errors import ApiError
from . import collections as col


def user_ref(db, uid: str):
    return db.collection(col.USERS).document(uid)


def new_user_doc(claims: dict) -> dict:
    """Profil initial d'un joueur (pseudo provisoire dérivé de son identifiant)."""
    username = f"Vif-{claims['uid'][:5].upper()}"
    return {
        "username": username,
        "username_lower": username.lower(),
        "email": claims.get("email"),
        "is_anonymous": _is_anonymous(claims),
        "created_at": now_iso(),
        **empty_stats(),
    }


def _is_anonymous(claims: dict) -> bool:
    return claims.get("firebase", {}).get("sign_in_provider") == "anonymous"


def ensure_user(db, claims: dict, snap=None) -> dict:
    """Profil du joueur, créé au besoin. Met à jour e-mail et statut invité après connexion.

    `snap` : instantané déjà lu (par exemple avec `get_all`), pour éviter une lecture de plus.
    """
    uid = claims["uid"]
    ref = user_ref(db, uid)
    snap = snap if snap is not None else ref.get()
    is_anonymous = _is_anonymous(claims)
    email = claims.get("email")
    if not snap.exists:
        doc = new_user_doc(claims)
        batch = db.batch()
        batch.set(ref, doc)
        batch.set(db.collection(col.USERNAMES).document(doc["username_lower"]), {"uid": uid})
        batch.commit()
        return doc
    doc = snap.to_dict()
    if doc.get("is_anonymous") != is_anonymous or doc.get("email") != email:
        ref.update({"is_anonymous": is_anonymous, "email": email})
        doc.update(is_anonymous=is_anonymous, email=email)
    return doc


def set_username(db, uid: str, username: str) -> str:
    """Change le pseudo ; l'unicité est garantie par `usernames/{pseudo}` dans une transaction."""
    lower = username.lower()
    ref = user_ref(db, uid)
    new_ref = db.collection(col.USERNAMES).document(lower)

    @firestore.transactional
    def run(tx):
        user = ref.get(transaction=tx).to_dict() or {}
        taken = new_ref.get(transaction=tx)
        if taken.exists and taken.to_dict().get("uid") != uid:
            raise ApiError(409, "Ce pseudo est déjà pris.")
        old = user.get("username_lower")
        if old and old != lower:
            tx.delete(db.collection(col.USERNAMES).document(old))
        tx.set(new_ref, {"uid": uid})
        tx.update(ref, {"username": username, "username_lower": lower})

    run(db.transaction())
    return username


def delete_account(db, uid: str) -> None:
    """Supprime le profil, toutes les participations, le pseudo et les signalements du joueur."""
    ref = user_ref(db, uid)
    for snap in ref.collection(col.ATTEMPTS).stream():
        snap.reference.delete()
    user = ref.get().to_dict() or {}
    if user.get("username_lower"):
        db.collection(col.USERNAMES).document(user["username_lower"]).delete()
    for snap in db.collection(col.REPORTS).where(filter=firestore.FieldFilter("uid", "==", uid)).stream():
        snap.reference.delete()
    ref.delete()
