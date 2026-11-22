import json
from datetime import date, timedelta
from pathlib import Path

import httpx
import pytest

from app import db


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    """Cada teste usa um banco SQLite próprio (nunca o storage/ de verdade)."""
    monkeypatch.setattr(db, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(db, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    from app.explore import store
    store.init()
    store.recent.clear()
    yield


def next_weekday(wd: int, start: date | None = None) -> date:
    start = start or date.today()
    return start + timedelta(days=(wd - start.weekday()) % 7 or 7)


@pytest.fixture
def local_file(tmp_path) -> Path:
    """Base local de teste com datas relativas a hoje (os testes não envelhecem)."""
    sat = next_weekday(5)
    far = date.today() + timedelta(days=40)
    data = {"experiences": [
        {"id": "run", "type": "recurring", "name": "Green Point parkrun", "category": "movement", "tags": ["parkrun", "corrida"],
         "outdoor": True, "description": "Corrida de 5 km todo sábado.",
         "location": {"venue": "Green Point Park", "neighborhood": "Green Point", "lat": -33.9042, "lon": 18.4010},
         "schedule": {"recurrence": "Sábado, 8h", "days": [5]}, "price": {"is_free": True, "min": 0, "currency": "ZAR"},
         "source": {"url": "https://example.org/parkrun", "checked_at": "2026-11-22"}},
        {"id": "market", "type": "recurring", "name": "Neighbourgoods Market", "category": "food-community",
         "tags": ["mercado", "market"], "outdoor": False,
         "location": {"venue": "Old Biscuit Mill", "neighborhood": "Woodstock", "lat": -33.9274, "lon": 18.4573},
         "schedule": {"recurrence": "Sábados", "days": [5]}, "price": {"is_free": True, "min": 0, "currency": "ZAR"},
         "source": {"url": "https://example.org/ngm", "checked_at": "2026-11-22"}},
        {"id": "afro", "type": "event", "name": "Afro House Sunset Session", "category": "music-night",
         "tags": ["afro house", "festa"], "outdoor": True,
         "location": {"venue": "Rooftop Sea Point", "neighborhood": "Sea Point", "lat": -33.9175, "lon": 18.3870},
         "schedule": {"date": sat.isoformat(), "time": "17:00"}, "price": {"min": 150, "currency": "ZAR"},
         "links": {"tickets": "https://example.org/tickets", "instagram": "https://www.instagram.com/afrohouse_ct/"},
         "source": {"url": "https://example.org/afro", "checked_at": "2026-11-22"}},
        {"id": "later", "type": "event", "name": "Jazz no Kirstenbosch", "category": "music-night", "tags": ["jazz"],
         "location": {"venue": "Kirstenbosch", "neighborhood": "Newlands", "lat": -33.9875, "lon": 18.4327},
         "schedule": {"date": far.isoformat()}, "source": {"url": "https://example.org/jazz", "checked_at": "2026-11-22"}},
        {"id": "nosource", "type": "recurring", "name": "Sem fonte", "source": {}},
    ]}
    p = tmp_path / "experiences.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


GOOGLE_PLACE = {
    "id": "ChIJyoga123", "displayName": {"text": "Sea Point Yoga Studio"},
    "formattedAddress": "100 Main Rd, Sea Point, Cape Town", "location": {"latitude": -33.918, "longitude": 18.388},
    "types": ["yoga_studio", "point_of_interest", "establishment"], "primaryType": "yoga_studio",
    "priceLevel": "PRICE_LEVEL_INEXPENSIVE", "websiteUri": "https://yoga.example.org",
    "googleMapsUri": "https://maps.google.com/?cid=1", "photos": [{"name": "places/ChIJyoga123/photos/AbC_1"}],
    "addressComponents": [{"longText": "Sea Point", "types": ["sublocality_level_1", "sublocality"]}],
}

TM_EVENT = {
    "id": "Z7r9jZ1A7", "name": "Afro House Festival", "url": "https://www.ticketmaster.co.za/event/Z7r9jZ1A7",
    "dates": {"start": {"localDate": "2099-01-10", "localTime": "18:00:00", "dateTime": "2099-01-10T16:00:00Z"},
              "timezone": "Africa/Johannesburg"},
    "classifications": [{"segment": {"name": "Music"}, "genre": {"name": "Dance/Electronic"}}],
    "priceRanges": [{"type": "standard", "currency": "ZAR", "min": 250.0, "max": 450.0}],
    "images": [{"ratio": "16_9", "url": "https://s1.ticketm.net/img.jpg", "width": 1024}],
    "_embedded": {"venues": [{"name": "Grand Arena", "city": {"name": "Cape Town"}, "address": {"line1": "GrandWest"},
                              "location": {"latitude": "-33.9180", "longitude": "18.5480"}}]},
}


def make_transport(google_status=200, tm_status=200, calls=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        host = request.url.host
        if host == "places.googleapis.com":
            if google_status != 200:
                return httpx.Response(google_status, json={"error": {"message": "API key not valid"}})
            return httpx.Response(200, json={"places": [GOOGLE_PLACE]})
        if host == "app.ticketmaster.com":
            if tm_status != 200:
                return httpx.Response(tm_status, json={})
            return httpx.Response(200, json={"_embedded": {"events": [TM_EVENT, TM_EVENT]}})
        if host == "open.er-api.com":
            return httpx.Response(200, json={"rates": {"BRL": 0.3}, "time_last_update_unix": 1795600000})
        return httpx.Response(404)
    return httpx.MockTransport(handler)
