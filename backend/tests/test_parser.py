from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.explore.parser import normalize, parse

TZ = ZoneInfo("Africa/Johannesburg")
WED = datetime(2026, 11, 25, 10, 0, tzinfo=TZ)  # quarta-feira


def test_exemplo_do_documento():
    i = parse("Quero uma festa de afro house sábado perto de Sea Point", now=WED)
    assert i.category == "music-night"
    assert i.activity == "afro house"
    assert i.date_from == date(2026, 11, 28) == i.date_to
    assert i.neighborhood == "Sea Point"
    assert i.wants_events is True


def test_data_no_fuso_local_vira_o_dia():
    # 23h30 de sábado em UTC já é domingo em Cape Town: "hoje" deve ser domingo.
    late = datetime(2026, 11, 28, 22, 30, tzinfo=ZoneInfo("UTC"))
    assert parse("o que fazer hoje", now=late).date_from == date(2026, 11, 29)


def test_preco_data_e_categoria():
    i = parse("yoga grátis amanhã", now=WED)
    assert i.category == "movement" and i.activity == "yoga"
    assert i.price == "free"
    assert i.date_from == date(2026, 11, 26)


def test_fim_de_semana_ao_ar_livre_com_amigos():
    i = parse("trilha ao ar livre no fim de semana com amigos", now=WED)
    assert i.category == "sports-adventure"
    assert i.outdoor is True
    assert (i.date_from, i.date_to) == (date(2026, 11, 28), date(2026, 11, 29))
    assert i.social == "social"


def test_ingles_e_bairro():
    i = parse("cheap jazz tonight in Woodstock", now=WED)
    assert i.activity == "jazz" and i.price == "budget"
    assert i.neighborhood == "Woodstock" and i.date_from == date(2026, 11, 25)


def test_data_explicita_no_proximo_ano():
    i = parse("museu dia 05/01", now=WED)
    assert i.date_from == date(2027, 1, 5)
    assert i.category == "arts-culture"


def test_busca_vazia_e_sem_categoria():
    assert parse("", now=WED).category is None
    i = parse("algo diferente", now=WED)
    assert i.category is None and i.date_from is None


def test_normalize():
    assert normalize("  Sábado À NOITE ") == "sabado a noite"


def test_enhancer_nao_derruba_a_busca():
    class Quebrado:
        def enhance(self, text, intent):
            raise RuntimeError("LLM fora do ar")
    assert parse("yoga", now=WED, enhancer=Quebrado()).activity == "yoga"
