"""Conversão para BRL. Só preenche quando o câmbio está disponível (nunca estima)."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from .cache import TTLCache

_cache = TTLCache(ttl=6 * 3600, max_items=20)


async def rate_to_brl(currency: str | None, client: httpx.AsyncClient) -> tuple[float, str] | None:
    """Quantos reais vale 1 unidade da moeda. Fonte: open.er-api.com (sem chave)."""
    if not currency:
        return None
    currency = currency.upper()
    if currency == "BRL":
        return 1.0, datetime.now(timezone.utc).date().isoformat()
    hit = _cache.get(currency)
    if hit:
        return hit
    try:
        r = await client.get(f"https://open.er-api.com/v6/latest/{currency}", timeout=5)
        data = r.json()
        rate = data.get("rates", {}).get("BRL")
        if not rate:
            return None
        when = datetime.fromtimestamp(data.get("time_last_update_unix", 0), timezone.utc).date().isoformat()
        _cache.set(currency, (float(rate), when))
        return float(rate), when
    except Exception:
        return None
