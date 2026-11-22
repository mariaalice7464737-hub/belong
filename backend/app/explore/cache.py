"""Cache em memória com prazo (TTL).

Usado só para respostas temporárias dos providers, respeitando os termos de cada um:
- Google Places: os termos permitem guardar o place_id; o conteúdo dos lugares é mantido aqui só
  por alguns minutos (EXPLORE_CACHE_TTL), em memória, nunca em disco.
- Ticketmaster: mesma regra (cache curto, em memória).
"""
from __future__ import annotations

import time
from typing import Any


class TTLCache:
    def __init__(self, ttl: float, max_items: int = 500):
        self.ttl, self.max_items = ttl, max_items
        self._data: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        hit = self._data.get(key)
        if not hit:
            return None
        expires, value = hit
        if expires < time.monotonic():
            self._data.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        if len(self._data) >= self.max_items:
            oldest = min(self._data, key=lambda k: self._data[k][0])
            self._data.pop(oldest, None)
        self._data[key] = (time.monotonic() + self.ttl, value)

    def clear(self) -> None:
        self._data.clear()
