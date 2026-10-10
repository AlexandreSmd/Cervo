"""Charge content/questions/*.json dans Firestore (par défaut seulement si la base est vide)."""

from __future__ import annotations

import argparse
import sys

from ..firebase import db
from ..questions import check_bank, load_files, to_doc
from ..service import now_iso


def seed(force: bool = False) -> int:
    client = db()
    col = client.collection("questions")
    if not force and any(True for _ in col.limit(1).stream()):
        print("Questions déjà présentes dans Firestore : rien à charger.")
        return 0
    valid, errors = check_bank(load_files())
    for err in errors:
        print(f"  ignorée : {err}", file=sys.stderr)
    created_at = now_iso()
    batch, count = client.batch(), 0
    for q in valid:
        batch.set(col.document(q.id), to_doc(q, created_at))
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = client.batch()
    batch.commit()
    print(f"{count} questions chargées dans Firestore.")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="recharge même si la base contient des questions")
    seed(force=parser.parse_args().force)


if __name__ == "__main__":
    main()
