"""Google Places API (New): estabelecimentos, escolas, estúdios, operadores e lugares.

Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
Chave: GOOGLE_PLACES_API_KEY (só no backend). Lugares NUNCA são apresentados como eventos.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ..categories import BY_ID
from ..normalize import clean_text, clean_url, maps_url, valid_coord
from ..schemas import Experience, Links, Location, Price, Schedule, Source
from .base import Provider, ProviderError, SearchContext

BASE = "https://places.googleapis.com/v1"
FIELDS = [
    "id", "displayName", "formattedAddress", "location", "types", "primaryType", "primaryTypeDisplayName",
    "priceLevel", "priceRange", "websiteUri", "googleMapsUri", "photos", "editorialSummary", "addressComponents",
]
PRICE_LEVEL = {
    "PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1, "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}
OUTDOOR_TYPES = {"park", "hiking_area", "beach", "campground", "national_park", "marina", "botanical_garden",
                 "dog_park", "state_park", "garden", "ski_resort", "golf_course"}
INDOOR_TYPES = {"museum", "art_gallery", "movie_theater", "performing_arts_theater", "library", "gym",
                "yoga_studio", "fitness_center", "night_club", "bar", "restaurant", "cafe", "coffee_shop"}
TYPE_CATEGORY = {
    "night_club": "music-night", "bar": "music-night", "live_music_venue": "music-night", "concert_hall": "music-night",
    "gym": "movement", "fitness_center": "movement", "yoga_studio": "movement", "spa": "movement", "sports_club": "sports-adventure",
    "park": "sports-adventure", "hiking_area": "sports-adventure", "beach": "sports-adventure", "sports_complex": "sports-adventure",
    "museum": "arts-culture", "art_gallery": "arts-culture", "performing_arts_theater": "arts-culture",
    "movie_theater": "arts-culture", "cultural_center": "arts-culture", "library": "arts-culture",
    "restaurant": "food-community", "cafe": "food-community", "coffee_shop": "food-community", "bakery": "food-community",
    "market": "food-community", "farmers_market": "food-community", "community_center": "food-community",
}


def build_query(ctx: SearchContext, city: str) -> str:
    i = ctx.intent
    if i.activity:
        what = i.activity
    elif i.keywords:
        what = " ".join(i.keywords[:5])
    elif ctx.category in BY_ID:
        what = BY_ID[ctx.category]["places_query"]
    else:
        what = "things to do"
    where = i.neighborhood or city
    return f"{what} in {where}"


def to_experience(p: dict, fetched_at: datetime, city: str, category_hint: str | None = None) -> Experience | None:
    pid = p.get("id")
    name = (p.get("displayName") or {}).get("text")
    if not pid or not name:
        return None
    loc = p.get("location") or {}
    lat, lon = loc.get("latitude"), loc.get("longitude")
    if not valid_coord(lat, lon):
        lat = lon = None
    neighborhood = None
    for comp in p.get("addressComponents") or []:
        types = set(comp.get("types") or [])
        if types & {"neighborhood", "sublocality", "sublocality_level_1"}:
            neighborhood = comp.get("longText")
            break
    types = set(p.get("types") or [])
    category = next((TYPE_CATEGORY[t] for t in [p.get("primaryType"), *types] if t in TYPE_CATEGORY), category_hint)
    level = PRICE_LEVEL.get(p.get("priceLevel"))
    price = Price(level=level, is_free=True if level == 0 else None)
    pr = p.get("priceRange") or {}
    if pr.get("startPrice"):
        price.min = float(pr["startPrice"].get("units", 0)) + pr["startPrice"].get("nanos", 0) / 1e9
        price.currency = pr["startPrice"].get("currencyCode")
    if pr.get("endPrice"):
        price.max = float(pr["endPrice"].get("units", 0)) + pr["endPrice"].get("nanos", 0) / 1e9
        price.currency = price.currency or pr["endPrice"].get("currencyCode")
    photos = p.get("photos") or []
    image = f"/api/explore/photo?ref={photos[0]['name']}" if photos and photos[0].get("name") else None
    tags = [t.replace("_", " ") for t in (p.get("types") or []) if t not in ("point_of_interest", "establishment")][:5]
    gmaps = clean_url(p.get("googleMapsUri")) or maps_url(name, lat, lon, pid)
    return Experience(
        id=f"google:{pid}",
        type="place",
        name=name,
        description=clean_text((p.get("editorialSummary") or {}).get("text")),
        category=category,
        tags=tags,
        location=Location(venue=name, address=p.get("formattedAddress"), neighborhood=neighborhood, city=city,
                          lat=lat, lon=lon, maps_url=gmaps),
        schedule=Schedule(),
        price=price,
        image=image,
        links=Links(website=clean_url(p.get("websiteUri"))),
        outdoor=True if types & OUTDOOR_TYPES else (False if types & INDOOR_TYPES else None),
        source=Source(provider="google", external_id=pid, url=gmaps, fetched_at=fetched_at, verification="provider"),
    )


class GooglePlacesProvider(Provider):
    id = "google"
    name = "Google Places"

    def is_enabled(self):
        if not self.settings.google_places_api_key:
            return False, "GOOGLE_PLACES_API_KEY não configurada"
        return True, None

    def _headers(self, fields: list[str]) -> dict:
        return {"X-Goog-Api-Key": self.settings.google_places_api_key, "X-Goog-FieldMask": ",".join(fields),
                "Content-Type": "application/json"}

    async def search(self, ctx: SearchContext) -> list[Experience]:
        body = {
            "textQuery": build_query(ctx, self.settings.city),
            "languageCode": "en",
            "pageSize": max(1, min(ctx.limit, 20)),
            "locationBias": {"circle": {"center": {"latitude": ctx.center_lat, "longitude": ctx.center_lon},
                                        "radius": min(ctx.radius_km * 1000, 50000.0)}},
        }
        try:
            r = await ctx.client.post(f"{BASE}/places:searchText", json=body,
                                      headers=self._headers([f"places.{f}" for f in FIELDS]))
        except httpx.HTTPError as e:
            raise ProviderError(f"falha de rede: {e.__class__.__name__}") from e
        if r.status_code != 200:
            msg = (r.json().get("error", {}) or {}).get("message", "") if r.headers.get("content-type", "").startswith("application/json") else ""
            raise ProviderError(f"HTTP {r.status_code} {msg}".strip())
        now = datetime.now(timezone.utc)
        out = [to_experience(p, now, self.settings.city, ctx.category) for p in r.json().get("places", [])]
        return [e for e in out if e]

    async def get(self, external_id: str, client: httpx.AsyncClient) -> Experience | None:
        if not self.is_enabled()[0]:
            return None
        r = await client.get(f"{BASE}/places/{external_id}", headers=self._headers(FIELDS))
        if r.status_code != 200:
            return None
        return to_experience(r.json(), datetime.now(timezone.utc), self.settings.city)

    async def photo_uri(self, ref: str, client: httpx.AsyncClient, max_width: int = 900) -> str | None:
        if not self.is_enabled()[0]:
            return None
        r = await client.get(f"{BASE}/{ref}/media", params={"maxWidthPx": max_width, "skipHttpRedirect": "true",
                                                             "key": self.settings.google_places_api_key})
        if r.status_code != 200:
            return None
        return clean_url(r.json().get("photoUri"))
