from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.explore.config import Settings
from app.explore.providers import BelongLocalProvider, GooglePlacesProvider, TicketmasterProvider
from app.explore.router import get_service
from app.explore.service import ExploreService
from app.explore_main import app

from .conftest import make_transport, next_weekday

DEVICE = {"X-Device-Id": "device-test-123"}


def settings(google=None, tm=None):
    return Settings(google_places_api_key=google, ticketmaster_api_key=tm, cors_origins=["http://localhost:5173"])


@pytest.fixture
def client_for(local_file):
    def build(google=None, tm=None, **transport_kw):
        s = settings(google, tm)
        svc = ExploreService(s, providers=[BelongLocalProvider(s, path=local_file), GooglePlacesProvider(s),
                                           TicketmasterProvider(s)], transport=make_transport(**transport_kw))
        app.dependency_overrides[get_service] = lambda: svc
        return TestClient(app)
    yield build
    app.dependency_overrides.clear()


def test_health_mostra_fontes_desligadas(client_for):
    r = client_for().get("/api/explore/health").json()
    by = {p["id"]: p for p in r["providers"]}
    assert by["belong"]["enabled"] is True
    assert by["google"]["enabled"] is False and "GOOGLE_PLACES_API_KEY" in by["google"]["reason"]
    assert by["ticketmaster"]["enabled"] is False


def test_categorias(client_for):
    cats = client_for().get("/api/explore/categories").json()
    assert [c["id"] for c in cats] == ["music-night", "movement", "sports-adventure", "arts-culture", "food-community"]


def test_busca_so_com_base_local(client_for):
    r = client_for().post("/api/explore/search", json={"q": "mercado sábado"}).json()
    names = [i["name"] for i in r["items"]]
    assert names[0] == "Neighbourgoods Market"
    assert all(i["source"]["provider"] == "belong" for i in r["items"])
    assert r["intent"]["category"] == "food-community"


def test_fluxo_completo_com_providers_reais_simulados(client_for):
    c = client_for(google="g-key", tm="t-key")
    r = c.post("/api/explore/search", json={"q": "festa de afro house sábado perto de Sea Point"}).json()
    st = {p["id"]: p for p in r["providers"]}
    assert st["google"]["ok"] and st["ticketmaster"]["ok"] and st["belong"]["ok"]
    # o evento local de sábado em Sea Point vem primeiro; o do Ticketmaster (2099) sai pelo filtro? não: data vem do parser só como preferência
    assert r["items"][0]["name"] == "Afro House Sunset Session"
    assert r["items"][0]["location"]["distance_km"] is not None  # bairro dá ponto de referência
    # o evento duplicado do Ticketmaster aparece uma vez só
    assert sum(1 for i in r["items"] if i["id"] == "ticketmaster:Z7r9jZ1A7") <= 1
    # preço convertido só com câmbio disponível
    afro = r["items"][0]
    assert afro["price"]["brl_min"] == 45.0 and afro["price"]["fx_rate"] == 0.3


def test_lugar_nunca_vira_evento(client_for):
    r = client_for(google="g").post("/api/explore/search", json={"q": "yoga"}).json()
    g = [i for i in r["items"] if i["source"]["provider"] == "google"]
    assert g and all(i["type"] == "place" and i["schedule"]["start"] is None for i in g)


def test_fonte_com_erro_nao_derruba_as_outras(client_for):
    r = client_for(google="bad", google_status=403).post("/api/explore/search", json={"q": "yoga"}).json()
    st = {p["id"]: p for p in r["providers"]}
    assert st["google"]["ok"] is False and "403" in st["google"]["error"]
    assert st["belong"]["ok"] is True
    assert any("Google Places" in w for w in r["warnings"])


def test_filtros_de_data_preco_e_ar_livre(client_for):
    c = client_for()
    sat = next_weekday(5).isoformat()
    r = c.post("/api/explore/search", json={"filters": {"date": "custom", "date_from": sat}}).json()
    names = {i["name"] for i in r["items"]}
    assert "Jazz no Kirstenbosch" not in names           # evento em outra data
    assert {"Green Point parkrun", "Neighbourgoods Market", "Afro House Sunset Session"} <= names
    r = c.post("/api/explore/search", json={"filters": {"price": "free"}}).json()
    assert all(i["price"]["is_free"] for i in r["items"])
    r = c.post("/api/explore/search", json={"filters": {"outdoor": True}}).json()
    assert all(i["outdoor"] is True for i in r["items"])


def test_dia_sem_atividade_recorrente(client_for):
    seg = next_weekday(0).isoformat()  # segunda: nada recorrente acontece
    r = client_for().post("/api/explore/search", json={"filters": {"date": "custom", "date_from": seg, "types": ["recurring"]}}).json()
    assert r["total"] == 0


def test_distancia_so_com_localizacao(client_for):
    c = client_for()
    r = c.post("/api/explore/search", json={"q": "corrida"}).json()
    assert all(i["location"]["distance_km"] is None for i in r["items"])
    r = c.post("/api/explore/search", json={"q": "", "lat": -33.905, "lon": 18.41, "filters": {"max_distance_km": 2}}).json()
    assert r["items"] and all(i["location"]["distance_km"] <= 2 for i in r["items"])


def test_paginacao(client_for):
    c = client_for()
    r1 = c.post("/api/explore/search", json={"page_size": 2}).json()
    r2 = c.post("/api/explore/search", json={"page_size": 2, "page": 2}).json()
    assert r1["has_more"] and len(r1["items"]) == 2
    assert not {i["id"] for i in r1["items"]} & {i["id"] for i in r2["items"]}


def test_validacao(client_for):
    c = client_for()
    assert c.post("/api/explore/search", json={"page_size": 999}).status_code == 422
    assert c.post("/api/explore/search", json={"filters": {"price": "carissimo"}}).status_code == 422


def test_detalhe(client_for):
    c = client_for()
    c.post("/api/explore/search", json={"q": "parkrun"})
    assert c.get("/api/explore/experiences/belong:run").json()["name"] == "Green Point parkrun"
    assert c.get("/api/explore/experiences/google:naoexiste").status_code == 404
    assert c.get("/api/explore/experiences/!!").status_code == 400


def test_favoritos_por_dispositivo(client_for):
    c = client_for()
    item = c.post("/api/explore/search", json={"q": "parkrun"}).json()["items"][0]
    assert c.get("/api/explore/favorites").status_code == 400  # sem X-Device-Id
    assert c.post("/api/explore/favorites", json={"experience": item}, headers=DEVICE).status_code == 201
    favs = c.get("/api/explore/favorites", headers=DEVICE).json()
    assert [f["id"] for f in favs] == ["belong:run"]
    assert c.get("/api/explore/favorites", headers={"X-Device-Id": "outro-aparelho"}).json() == []
    assert c.delete("/api/explore/favorites/belong:run", headers=DEVICE).status_code == 204
    assert c.delete("/api/explore/favorites/belong:run", headers=DEVICE).status_code == 404


def test_foto_sem_chave(client_for):
    assert client_for().get("/api/explore/photo?ref=places/a/photos/b").status_code == 404
    assert client_for(google="k").get("/api/explore/photo?ref=../../etc").status_code == 400
