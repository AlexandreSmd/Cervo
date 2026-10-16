"""Charge content/questions/*.json dans Firestore.

Par défaut, ajoute seulement les questions absentes (les modifications faites
depuis l'admin sont conservées). Avec --force, toutes les questions sont réécrites.
Dès qu'au moins une question est ajoutée, le quiz du jour (et les journées à venir composées
automatiquement) est recomposé pour jouer les nouveautés tout de suite. --keep-today l'évite.
"""

from __future__ import annotations

import argparse
import sys

from ..clock import now_iso, today
from ..firebase import db
from ..services.bank import bump_version, check_bank, load_files, to_doc
from ..services.planning import refresh_after_ship
from .migrate import retire_legacy


def seed(force: bool = False, keep_today: bool = False) -> int:
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
    retired, cleared = retire_legacy(client)
    if retired or cleared:
        print(f"Anciennes questions retirées : {retired} · journées à venir recomposées : {cleared}.")
    if count and not keep_today:
        days = refresh_after_ship(client, today())
        print(f"Quiz du jour recomposé avec les nouvelles questions ({len(days)} journée(s) mise(s) à jour).")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="réécrit toutes les questions depuis les fichiers")
    parser.add_argument("--keep-today", action="store_true", help="ne recompose pas le quiz du jour")
    args = parser.parse_args()
    seed(force=args.force, keep_today=args.keep_today)


if __name__ == "__main__":
    main()
