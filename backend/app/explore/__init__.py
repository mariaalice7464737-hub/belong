"""Explore: descoberta de experiências locais (eventos, atividades recorrentes e lugares).

Camadas:
    router.py      → endpoints HTTP (/api/explore/...)
    schemas.py     → modelos de entrada/saída (Experience, SearchRequest...)
    parser.py      → interpreta a busca em linguagem natural (regras determinísticas)
    service.py     → orquestra providers → normalização → validação → deduplicação → filtros → ranking → paginação
    providers/     → integrações externas (Google Places, Ticketmaster) e a base local verificada
    ranking.py, dedupe.py, normalize.py, cache.py, fx.py, store.py → peças do pipeline
"""
