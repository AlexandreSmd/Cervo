"""Temps : horodatages ISO en UTC et « jour du quiz » dans le fuseau de référence.

Les dates de quiz sont des chaînes AAAA-MM-JJ (fuseau TIMEZONE, Europe/Paris par défaut),
les horodatages des chaînes ISO 8601 en UTC : lisibles, triables, sérialisables tels quels.
"""

from __future__ import annotations

from datetime import UTC, datetime

from .config import get_settings
from .domain.daily import today_str


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def today() -> str:
    """Jour du quiz en cours : il change à minuit dans le fuseau de référence."""
    return today_str(get_settings().timezone)


def seconds_since(iso: str | None) -> float | None:
    if not iso:
        return None
    return (datetime.now(UTC) - datetime.fromisoformat(iso)).total_seconds()
