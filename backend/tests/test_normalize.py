from datetime import datetime, timezone

from app.explore.normalize import clean_instagram, clean_url
from app.explore.providers import google_places, ticketmaster
from app.explore.providers.belong_local import load_raw, to_experience as local_to_exp

from .conftest import GOOGLE_PLACE, TM_EVENT

NOW = datetime(2026, 11, 22, tzinfo=timezone.utc)


def test_google_vira_lugar_sem_inventar_dados():
    e = google_places.to_experience(GOOGLE_PLACE, NOW, "Cape Town")
    assert e.id == "google:ChIJyoga123" and e.type == "place"
    assert e.category == "movement"
    assert e.location.neighborhood == "Sea Point"
    assert e.price.level == 1 and e.price.min is None and e.price.currency is None
    assert e.schedule.start is None and e.schedule.date_confirmed is False   # lugar não é evento
    assert e.image == "/api/explore/photo?ref=places/ChIJyoga123/photos/AbC_1"  # sem a chave na URL
    assert e.links.instagram is None and e.description is None
    assert e.outdoor is False
    assert e.source.provider == "google" and e.source.verification == "provider"


def test_google_sem_nome_e_descartado():
    assert google_places.to_experience({"id": "x"}, NOW, "Cape Town") is None


def test_ticketmaster_vira_evento_com_fuso_e_preco():
    e = ticketmaster.to_experience(TM_EVENT, NOW, "Africa/Johannesburg")
    assert e.type == "event" and e.category == "music-night"
    assert e.schedule.start.isoformat() == "2099-01-10T18:00:00+02:00"
    assert e.schedule.date_confirmed and e.schedule.time_confirmed
    assert (e.price.min, e.price.max, e.price.currency) == (250.0, 450.0, "ZAR")
    assert e.price.brl_min is None  # conversão só no serviço, com câmbio real
    assert e.links.tickets.startswith("https://www.ticketmaster.co.za")
    assert e.location.lat == -33.918


def test_ticketmaster_data_a_confirmar():
    ev = {**TM_EVENT, "dates": {"start": {"localDate": "2099-01-10", "dateTBA": True}}}
    e = ticketmaster.to_experience(ev, NOW, "Africa/Johannesburg")
    assert e.schedule.date_confirmed is False and e.schedule.time_confirmed is False


def test_links_validados():
    assert clean_url("javascript:alert(1)") is None
    assert clean_url("ftp://x.org") is None
    assert clean_url("https://ok.org/a") == "https://ok.org/a"
    assert clean_instagram("https://www.instagram.com/belong_ct/") is not None
    assert clean_instagram("https://instagr.am/x") is None
    assert clean_instagram("https://facebook.com/x") is None


def test_local_exige_fonte(local_file):
    raws = load_raw(local_file)
    out = [local_to_exp(r, "Africa/Johannesburg") for r in raws]
    assert out[-1] is None  # item sem source.url é ignorado
    afro = out[2]
    assert afro.schedule.time_confirmed and afro.links.instagram == "https://www.instagram.com/afrohouse_ct/"
    assert afro.source.verification == "verified"
