"""Charge content/questions/*.json dans Firestore.

Par défaut, ajoute seulement les questions absentes (les modifications faites
depuis l'admin sont conservées). Avec --force, toutes les questions sont réécrites.
"""

from __future__ import annotations

import argparse
import sys

from ..clock import now_iso
from ..firebase import db
from ..services.bank import bump_version, check_bank, load_files, to_doc


def seed(force: bool = False) -> int:
    client = db()
    col = client.collection("questions")
    existing = set() if force else {ref.id for ref in col.list_documents()}
    valid, errors = check_bank(load_files())
    for err in errors:
        print(f"  ignorée : {err}", file=sys.stderr)
    created_at = now_iso()
    batch, count = client.batch(), 0
    for q in valid:
        if q.id in existing:
            continue
        batch.set(col.document(q.id), to_doc(q, created_at))
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = client.batch()
    batch.commit()
    bump_version(client)
    if count:
        print(f"{count} question(s) chargée(s) dans Firestore ({len(valid)} dans la banque).")
    else:
        print(f"Banque à jour : {len(valid)} questions déjà dans Firestore.")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="réécrit toutes les questions depuis les fichiers")
    seed(force=parser.parse_args().force)


if __name__ == "__main__":
    main()
