"""Endpoints do Explore (prefixo /api/explore). Documentação automática em /docs."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from functools import lru_cache

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import RedirectResponse

from . import store
from .categories import CATEGORIES
from .config import get_settings
from .providers.google_places import GooglePlacesProvider
from .schemas import Category, Experience, Favorite, FavoriteIn, SearchRequest, SearchResponse
from .service import ExploreService

router = APIRouter(prefix="/api/explore", tags=["explore"])
PHOTO_REF_RE = re.compile(r"^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$")


@lru_cache
def _service() -> ExploreService:
    return ExploreService(get_settings())


def get_service() -> ExploreService:
    """Dependência substituível nos testes (app.dependency_overrides)."""
    return _service()


def device_id(x_device_id: str | None = Header(default=None)) -> str:
    if not store.valid_device(x_device_id):
        raise HTTPException(400, "Cabeçalho X-Device-Id ausente ou inválido (8–64 caracteres: letras, números, - ou _).")
    return x_device_id


@router.get("/health")
def health(svc: ExploreService = Depends(get_service)) -> dict:
    statuses = svc.statuses()
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat(), "city": svc.settings.city,
            "providers": [s.model_dump() for s in statuses], "active": sum(s.enabled for s in statuses)}


@router.get("/categories", response_model=list[Category])
def categories() -> list[Category]:
    return [Category(id=c["id"], label=c["label"], label_en=c["label_en"], icon=c["icon"]) for c in CATEGORIES]


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, svc: ExploreService = Depends(get_service)) -> SearchResponse:
    return await svc.search(req)


@router.get("/experiences/{experience_id:path}", response_model=Experience)
async def experience(experience_id: str, svc: ExploreService = Depends(get_service)) -> Experience:
    if not re.match(r"^[a-z]+:[A-Za-z0-9_.:-]+$", experience_id):
        raise HTTPException(400, "Identificador inválido")
    e = await svc.get(experience_id)
    if not e:
        raise HTTPException(404, "Experiência não encontrada (pode ter saído do cache ou a fonte está desativada)")
    return e


@router.get("/favorites", response_model=list[Favorite])
def favorites(device: str = Depends(device_id)) -> list[Favorite]:
    return store.list_favorites(device)


@router.post("/favorites", response_model=Favorite, status_code=201)
def add_favorite(body: FavoriteIn, device: str = Depends(device_id)) -> Favorite:
    return store.save_favorite(device, body.experience)


@router.delete("/favorites/{experience_id:path}", status_code=204)
def remove_favorite(experience_id: str, device: str = Depends(device_id)) -> None:
    if not store.delete_favorite(device, experience_id):
        raise HTTPException(404, "Favorito não encontrado")


@router.get("/photo", include_in_schema=False)
async def photo(ref: str = Query(...), svc: ExploreService = Depends(get_service)):
    """Foto do Google Places sem expor a chave: o backend pede o link e redireciona."""
    if not PHOTO_REF_RE.match(ref):
        raise HTTPException(400, "Referência de foto inválida")
    p = svc.provider("google")
    if not isinstance(p, GooglePlacesProvider) or not p.is_enabled()[0]:
        raise HTTPException(404, "Fotos do Google indisponíveis")
    async with svc.client() as client:
        uri = await p.photo_uri(ref, client)
    if not uri:
        raise HTTPException(404, "Foto não encontrada")
    return RedirectResponse(uri, status_code=302, headers={"Cache-Control": "public, max-age=3600"})
