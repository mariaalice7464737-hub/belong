"""Ticketmaster Discovery API v2: eventos com data, local e link de ingresso.

Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
Chave: TICKETMASTER_API_KEY. A cobertura de eventos sul-africanos nesta API não é garantida:
o status da busca mostra quantos resultados vieram desta fonte.
"""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

from ..categories import BY_ID
from ..normalize import clean_text, clean_url, maps_url, parse_datetime, valid_coord
from ..schemas import Experience, Links, Location, Price, Schedule, Source
from .base import Provider, ProviderError, SearchContext

BASE = "https://app.ticketmaster.com/discovery/v2"
SEGMENT_CATEGORY = {"Music": "music-night", "Sports": "sports-adventure", "Arts & Theatre": "arts-culture",
                    "Film": "arts-culture", "Miscellaneous": None}


def _best_image(images: list[dict]) -> str | None:
    wide = [i for i in images or [] if i.get("ratio") == "16_9"] or images or []
    wide = sorted(wide, key=lambda i: i.get("width") or 0, reverse=True)
    return clean_url(wide[0].get("url")) if wide else None


def to_experience(ev: dict, fetched_at: datetime, default_tz: str) -> Experience | None:
    eid, name = ev.get("id"), ev.get("name")
    if not eid or not name:
        return None
    dates = ev.get("dates") or {}
    start = dates.get("start") or {}
    tzname = dates.get("timezone") or default_tz
    dt = parse_datetime(start.get("dateTime"))
    time_confirmed = bool(dt) and not start.get("timeTBA") and not start.get("noSpecificTime")
    date_confirmed = bool(dt or start.get("localDate")) and not start.get("dateTBA") and not start.get("dateTBD")
    if not dt and start.get("localDate"):
        try:
            dt = datetime.fromisoformat(start["localDate"]).replace(tzinfo=ZoneInfo(tzname))
        except (ValueError, KeyError):
            dt = None
    if dt:
        try:
            dt = dt.astimezone(ZoneInfo(tzname))
        except Exception:
            pass
    end = parse_datetime((dates.get("end") or {}).get("dateTime"))

    venue = ((ev.get("_embedded") or {}).get("venues") or [{}])[0]
    vloc = venue.get("location") or {}
    lat, lon = vloc.get("latitude"), vloc.get("longitude")
    lat, lon = (float(lat), float(lon)) if valid_coord(lat, lon) else (None, None)
    address = ", ".join(x for x in [(venue.get("address") or {}).get("line1"), (venue.get("city") or {}).get("name")] if x) or None

    cls = (ev.get("classifications") or [{}])[0]
    segment = (cls.get("segment") or {}).get("name")
    genre = (cls.get("genre") or {}).get("name")
    sub = (cls.get("subGenre") or {}).get("name")
    tags = [t for t in [genre, sub] if t and t not in ("Undefined", "Other")]

    pr = (ev.get("priceRanges") or [{}])[0]
    price = Price(min=pr.get("min"), max=pr.get("max"), currency=pr.get("currency"))
    if price.min == 0 and (price.max in (0, None)):
        price.is_free = True

    url = clean_url(ev.get("url"))
    return Experience(
        id=f"ticketmaster:{eid}",
        type="event",
        name=name,
        description=clean_text(ev.get("info") or ev.get("description") or ev.get("pleaseNote")),
        category=SEGMENT_CATEGORY.get(segment),
        tags=tags,
        location=Location(venue=venue.get("name"), address=address, city=(venue.get("city") or {}).get("name"),
                          lat=lat, lon=lon, maps_url=maps_url(venue.get("name") or name, lat, lon)),
        schedule=Schedule(start=dt, end=end, timezone=tzname, date_confirmed=date_confirmed and dt is not None,
                          time_confirmed=time_confirmed),
        price=price,
        image=_best_image(ev.get("images")),
        links=Links(tickets=url),
        outdoor=None,
        source=Source(provider="ticketmaster", external_id=eid, url=url, fetched_at=fetched_at, verification="provider"),
    )


class TicketmasterProvider(Provider):
    id = "ticketmaster"
    name = "Ticketmaster"

    def is_enabled(self):
        if not self.settings.ticketmaster_api_key:
            return False, "TICKETMASTER_API_KEY não configurada"
        return True, None

    async def search(self, ctx: SearchContext) -> list[Experience]:
        params = {
            "apikey": self.settings.ticketmaster_api_key,
            "latlong": f"{ctx.center_lat},{ctx.center_lon}",
            "radius": int(max(1, ctx.radius_km)),
            "unit": "km",
            "size": max(1, min(ctx.limit, 50)),
            "sort": "date,asc",
            "locale": "*",
            "startDateTime": (ctx.start or ctx.now).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if ctx.end:
            params["endDateTime"] = ctx.end.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        kw = ctx.intent.activity or " ".join(ctx.intent.keywords[:3])
        if kw:
            params["keyword"] = kw
        seg = BY_ID.get(ctx.category or "", {}).get("tm_segment")
        if seg:
            params["segmentName"] = seg
        try:
            r = await ctx.client.get(f"{BASE}/events.json", params=params)
        except httpx.HTTPError as e:
            raise ProviderError(f"falha de rede: {e.__class__.__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"HTTP {r.status_code}")
        now = datetime.now(timezone.utc)
        events = ((r.json().get("_embedded") or {}).get("events")) or []
        out = [to_experience(ev, now, self.settings.timezone) for ev in events]
        return [e for e in out if e]

    async def get(self, external_id: str, client: httpx.AsyncClient) -> Experience | None:
        if not self.is_enabled()[0]:
            return None
        r = await client.get(f"{BASE}/events/{external_id}.json", params={"apikey": self.settings.ticketmaster_api_key, "locale": "*"})
        if r.status_code != 200:
            return None
        return to_experience(r.json(), datetime.now(timezone.utc), self.settings.timezone)
