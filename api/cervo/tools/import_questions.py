"""Importe un fichier JSON de questions dans Firestore (émulateur en local).

Usage : npm run questions:import -- chemin/vers/fichier.json [--overwrite]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..clock import now_iso
from ..firebase import db
from ..services.bank import check_bank, invalidate_cache, to_doc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file")
    parser.add_argument("--overwrite", action="store_true", help="remplace les questions de même identifiant")
    args = parser.parse_args()
    path = Path(args.file)
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("questions", [data] if "prompt" in data else [])
    for raw in data:
        raw.setdefault("_file", path.name)
    valid, errors = check_bank(data)
    for err in errors:
        print(f"  ignorée : {err}", file=sys.stderr)
    client = db()
    col = client.collection("questions")
    created = skipped = 0
    batch = client.batch()
    for q in valid:
        ref = col.document(q.id)
        if not args.overwrite and ref.get().exists:
            skipped += 1
            continue
        batch.set(ref, to_doc(q, now_iso()))
        created += 1
    batch.commit()
    invalidate_cache()
    print(f"{created} question(s) importée(s), {skipped} déjà présente(s), {len(errors)} en erreur.")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
