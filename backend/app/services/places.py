"""Extract place references from a transcript.

Gazetteer-first: match known location names/aliases from the database, then
fall back to a cross-street regex ("7th and Wood", "Chestnut & 8th"). The same
function powers both the contributor step ("Places you mentioned") and the
backfill pass over existing interviews.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Location

_STREET = r"(?:\d{1,2}(?:st|nd|rd|th)|[A-Z][a-z]+)"
CROSS_RE = re.compile(rf"\b({_STREET})\s+(?:and|&)\s+({_STREET})\b(?:\s+(?:Street|St\.?))?")
ORDINAL_RE = re.compile(r"^\d{1,2}(?:st|nd|rd|th)$", re.I)


def _norm_cross(a: str, b: str) -> str:
    def fix(s: str) -> str:
        return s.lower() if ORDINAL_RE.match(s) else s.capitalize()
    a, b = fix(a), fix(b)
    # Put the numbered street first for a stable label: "7th & Wood St"
    if ORDINAL_RE.match(b) and not ORDINAL_RE.match(a):
        a, b = b, a
    return f"{a} & {b} St"


def extract_places(db: Session, transcript: str) -> list[dict]:
    text = transcript or ""
    low = text.lower()
    found: list[dict] = []
    seen: set[str] = set()

    for loc in db.execute(select(Location)).scalars():
        names = [loc.name, *(loc.aliases or [])]
        if loc.cross_street:
            names.append(loc.cross_street)
        for n in names:
            if n and n.lower() in low:
                key = loc.name.lower()
                if key not in seen:
                    seen.add(key)
                    found.append({
                        "name": loc.name,
                        "source": "transcript",
                        "lat": loc.lat,
                        "lng": loc.lng,
                        "location_id": loc.id,
                        "confidence": 0.9,
                    })
                break

    for m in CROSS_RE.finditer(text):
        label = _norm_cross(m.group(1), m.group(2))
        key = label.lower()
        if key in seen:
            continue
        # Skip if a gazetteer hit already covers this cross street
        if any((p.get("name", "").lower() == key) for p in found):
            continue
        seen.add(key)
        found.append({"name": label, "source": "transcript", "lat": None, "lng": None, "location_id": None, "confidence": 0.6})

    return found
