"""Valide la banque de questions : format, doublons, réponses incohérentes."""

from __future__ import annotations

import sys
from collections import Counter

from ..catalog import CATEGORIES
from ..daily import MIN_POOL
from ..questions import check_bank, load_files


def main() -> None:
    raws = load_files()
    valid, errors = check_bank(raws)
    published = [q for q in valid if q.status == "published"]
    print(f"{len(raws)} questions lues, {len(valid)} valides, {len(published)} publiées.")
    by_cat = Counter(q.category for q in published)
    for key, label in CATEGORIES.items():
        print(f"  {label:<20} {by_cat.get(key, 0):>4}")
    by_type = Counter(q.type for q in published)
    by_diff = Counter(q.difficulty for q in published)
    print("  types :", dict(by_type))
    print("  difficultés :", dict(sorted(by_diff.items())))
    by_input = Counter(q.input_format for q in published)
    print("  formats d'entrée :", dict(by_input))
    if errors:
        print(f"\n{len(errors)} problème(s) :", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    if len(published) < 120:
        print(f"\nAttention : {len(published)} questions publiées, le MVP en demande au moins 120.", file=sys.stderr)
        sys.exit(1)
    if len(published) < MIN_POOL:
        sys.exit(1)
    print("\nBanque valide.")


if __name__ == "__main__":
    main()
