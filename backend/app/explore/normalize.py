"""Validação de campos vindos de fontes externas. O que não passa vira None."""
from __future__ import annotations

import math
import re
from datetime import datetime
from urllib.parse import urlparse

INSTAGRAM_RE = re.compile(r"^https?://(www\.)?instagram\.com/[A-Za-z0-9_.]+/?(\?.*)?$")


def clean_url(url: str | None) -> str | None:
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc or "." not in p.netloc:
        return None
    return url


def clean_instagram(url: str | None) -> str | None:
    """Só aceita link de perfil do Instagram de verdade (nunca deduz a partir do nome)."""
    url = clean_url(url)
    return url if url and INSTAGRAM_RE.match(url) else None


def clean_text(text: str | None, limit: int = 600) -> str | None:
    if not text or not isinstance(text, str):
        return None
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()
    if not text:
        return None
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def valid_coord(lat, lon) -> bool:
    try:
        return -90 <= float(lat) <= 90 and -180 <= float(lon) <= 180
    except (TypeError, ValueError):
        return False


def maps_url(name: str | None, lat: float | None, lon: float | None, place_id: str | None = None) -> str | None:
    from urllib.parse import quote
    if place_id:
        return f"https://www.google.com/maps/search/?api=1&query={quote(name or 'place')}&query_place_id={place_id}"
    if lat is not None and lon is not None:
        return f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
    if name:
        return f"https://www.google.com/maps/search/?api=1&query={quote(name)}"
    return None
