"""API pública só com o Explore (é esta que vai para o Render).

As rotas de documentos/arquivos do app NÃO entram aqui: elas não têm login e devem
continuar só no computador (app.main). Rodar:
    uvicorn app.explore_main:app --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .explore import store
from .explore.config import get_settings
from .explore.router import router

settings = get_settings()
store.init()

app = FastAPI(title="Belong Explore API", version="1.0.0",
              description="Descoberta de experiências locais. Fontes: Belong (verificados), Google Places, Ticketmaster.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["Content-Type", "X-Device-Id"])
app.include_router(router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "belong-explore"}
