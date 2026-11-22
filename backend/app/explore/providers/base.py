"""Contrato comum das fontes de experiências."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

import httpx

from ..schemas import Experience, Intent, ProviderStatus


@dataclass
class SearchContext:
    intent: Intent
    category: str | None
    center_lat: float
    center_lon: float
    radius_km: float
    start: datetime | None          # início do período (com fuso), se houver filtro de data
    end: datetime | None
    limit: int
    client: httpx.AsyncClient
    now: datetime


class ProviderError(Exception):
    """Falha de uma fonte: vira aviso na resposta, sem derrubar as outras fontes."""


class Provider(ABC):
    id: str = "base"
    name: str = "Base"

    def __init__(self, settings):
        self.settings = settings

    def status(self) -> ProviderStatus:
        enabled, reason = self.is_enabled()
        return ProviderStatus(id=self.id, name=self.name, enabled=enabled, reason=reason)

    def is_enabled(self) -> tuple[bool, str | None]:
        return True, None

    @abstractmethod
    async def search(self, ctx: SearchContext) -> list[Experience]: ...

    async def get(self, external_id: str, client: httpx.AsyncClient) -> Experience | None:
        return None
