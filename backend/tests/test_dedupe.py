from datetime import datetime, timezone

from app.explore.dedupe import dedupe
from app.explore.schemas import Experience, Location, Schedule, Source

NOW = datetime(2026, 11, 22, tzinfo=timezone.utc)


def exp(id_, name, provider="ticketmaster", ext=None, day=None, venue="Arena", verification="provider"):
    return Experience(id=f"{provider}:{id_}", type="event", name=name, location=Location(venue=venue),
                      schedule=Schedule(start=day, date_confirmed=bool(day)),
                      source=Source(provider=provider, external_id=ext or id_, fetched_at=NOW, verification=verification))


def test_mesmo_id_externo():
    a, b = exp("1", "Show"), exp("1", "Show (cópia)")
    assert len(dedupe([a, b])) == 1


def test_mesmo_titulo_data_local_entre_fontes_fica_o_verificado():
    d = datetime(2026, 12, 1, 20, tzinfo=timezone.utc)
    tm = exp("9", "Mi Casa Live", day=d, venue="Kirstenbosch")
    local = exp("mc", "MI CASA  live", provider="belong", day=d, venue="kirstenbosch", verification="verified")
    out = dedupe([tm, local])
    assert len(out) == 1 and out[0].source.provider == "belong"


def test_mesmo_titulo_em_datas_diferentes_nao_e_duplicado():
    a = exp("1", "Jazz Night", day=datetime(2026, 12, 1, tzinfo=timezone.utc))
    b = exp("2", "Jazz Night", day=datetime(2026, 12, 8, tzinfo=timezone.utc))
    assert len(dedupe([a, b])) == 2
