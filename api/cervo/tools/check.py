"""Valide la banque de questions : format, doublons, réponses incohérentes, couverture des 10 types."""

from __future__ import annotations

import sys
from collections import Counter

from ..domain.catalog import DAILY_ORDER, DIFFICULTIES, KINDS
from ..domain.timing import time_limit
from ..services.bank import check_bank, load_files


def main() -> None:
    raws = load_files()
    valid, errors = check_bank(raws)
    published = [q for q in valid if q.status == "published"]
    print(f"{len(raws)} questions lues, {len(valid)} valides, {len(published)} publiées.\n")
    print(f"  {'Type':<16} {'Questions':>9}   {'Niveaux (F/M/D)':<16} Chronos")
    empty = []
    for key in DAILY_ORDER:
        mine = [q for q in published if q.category == key]
        diff = Counter(q.difficulty for q in mine)
        levels = "/".join(str(diff.get(d, 0)) for d in DIFFICULTIES)
        chronos = sorted({time_limit(q.model_dump()) or 0 for q in mine})
        shown = ", ".join("sans" if c == 0 else f"{c} s" for c in chronos)
        print(f"  {KINDS[key].emoji} {KINDS[key].label:<14} {len(mine):>9}   {levels:<16} {shown}")
        if not mine:
            empty.append(KINDS[key].label)
    rotation = min((sum(1 for q in published if q.category == k) for k in DAILY_ORDER), default=0)
    print(f"\n  Rotation : {rotation} jour(s) avant qu'une question ne revienne.")
    if errors:
        print(f"\n{len(errors)} problème(s) :", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    if empty:
        print(f"\nAucune question publiée pour : {', '.join(empty)}.", file=sys.stderr)
        sys.exit(1)
    print("\nBanque valide.")


if __name__ == "__main__":
    main()
