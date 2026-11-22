"""Belong Local: experiências cadastradas e conferidas à mão (data/experiences.json).

Cada item precisa de uma fonte (source.url) e da data em que foi conferido (checked_at).
Itens sem fonte são ignorados. Para incluir algo, edite o JSON; não há geração automática.
"""
from __future__ import annotations

import json
from datetime import datetime, time, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from ..normalize import clean_instagram, clean_text, clean_url, maps_url, valid_coord
from ..parser import normalize
from ..schemas import Experience, Links, Location, Price, Schedule, Source
from .base import Provider, SearchContext

DATA = Path(__file__).resolve().parents[2] / "data" / "experiences.json"


def load_raw(path: Path = DATA) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return data.get("experiences", []) if isinstance(data, dict) else data


def to_experience(raw: dict, tz: str) -> Experience | None:
    src = raw.get("source") or {}
    if not raw.get("id") or not raw.get("name") or not clean_url(src.get("url")):
        return None
    loc = raw.get("location") or {}
    lat, lon = loc.get("lat"), loc.get("lon")
    if not valid_coord(lat, lon):
        lat = lon = None
    sch = raw.get("schedule") or {}
    start = None
    if sch.get("date"):
        h, m = (map(int, sch["time"].split(":")) if sch.get("time") else (0, 0))
        start = datetime.combine(datetime.fromisoformat(sch["date"]).date(), time(h, m), ZoneInfo(tz))
    pr = raw.get("price") or {}
    checked = src.get("checked_at")
    return Experience(
        id=f"belong:{raw['id']}",
        type=raw.get("type", "recurring"),
        name=raw["name"],
        description=clean_text(raw.get("description")),
        category=raw.get("category"),
        tags=raw.get("tags") or [],
        location=Location(venue=loc.get("venue"), address=loc.get("address"), neighborhood=loc.get("neighborhood"),
                          city=loc.get("city", "Cape Town"), lat=lat, lon=lon,
                          maps_url=maps_url(loc.get("venue") or raw["name"], lat, lon)),
        schedule=Schedule(start=start, timezone=tz, date_confirmed=bool(sch.get("date")),
                          time_confirmed=bool(sch.get("date") and sch.get("time")),
                          recurrence=sch.get("recurrence"), recurrence_days=sch.get("days"),
                          season_start=sch.get("season_start"), season_end=sch.get("season_end")),
        price=Price(min=pr.get("min"), max=pr.get("max"), currency=pr.get("currency"), is_free=pr.get("is_free")),
        image=clean_url(raw.get("image")),
        links=Links(website=clean_url((raw.get("links") or {}).get("website")),
                    tickets=clean_url((raw.get("links") or {}).get("tickets")),
                    instagram=clean_instagram((raw.get("links") or {}).get("instagram"))),
        outdoor=raw.get("outdoor"),
        source=Source(provider="belong", external_id=raw["id"], url=clean_url(src.get("url")),
                      fetched_at=datetime.fromisoformat(checked).replace(tzinfo=timezone.utc) if checked else datetime.now(timezone.utc),
                      verification="verified" if checked else "unverified"),
    )


class BelongLocalProvider(Provider):
    id = "belong"
    name = "Belong (verificados)"

    def __init__(self, settings, path: Path = DATA):
        super().__init__(settings)
        self.path = path

    def _all(self) -> list[Experience]:
        out = [to_experience(r, self.settings.timezone) for r in load_raw(self.path)]
        return [e for e in out if e]

    def is_enabled(self):
        return (True, None) if self.path.exists() else (False, "data/experiences.json não encontrado")

    async def search(self, ctx: SearchContext) -> list[Experience]:
        items = self._all()
        i = ctx.intent
        terms = [normalize(t) for t in ([i.activity] if i.activity else []) + i.keywords]
        if not terms and not ctx.category:
            return items
        out = []
        for e in items:
            hay = normalize(" ".join([e.name, e.description or "", " ".join(e.tags), e.location.neighborhood or "",
                                      e.location.venue or ""]))
            if (ctx.category and e.category == ctx.category) or any(t in hay for t in terms):
                out.append(e)
        return out

    async def get(self, external_id: str, client=None) -> Experience | None:
        return next((e for e in self._all() if e.source.external_id == external_id), None)
