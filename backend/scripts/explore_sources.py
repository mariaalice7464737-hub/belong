"""Demonstração das fontes do Explore: qual está ligada e o que cada uma devolve de verdade.

Uso (dentro de backend/, com as chaves no .env ou no ambiente):
    python -m scripts.explore_sources "yoga em Sea Point"
    python -m scripts.explore_sources --api https://SEU-BACKEND.onrender.com "festa sábado"
"""
from __future__ import annotations

import argparse
import asyncio
import json

import httpx


def show(statuses, items):
    print("\nFONTES")
    for s in statuses:
        state = "ligada" if s["enabled"] else f"desligada ({s.get('reason')})"
        res = "" if not s["enabled"] else (f" → {s.get('count', 0)} resultado(s)" if s.get("ok") else f" → ERRO: {s.get('error')}")
        print(f"  - {s['name']}: {state}{res}")
    print(f"\nRESULTADOS ({len(items)} nesta página)")
    for e in items[:10]:
        when = e["schedule"].get("start") or e["schedule"].get("recurrence") or "-"
        print(f"  [{e['source']['provider']}] {e['type']:9} {e['name']}  ·  {when}")


async def local(q: str):
    from app.explore.config import get_settings
    from app.explore.schemas import SearchRequest
    from app.explore.service import ExploreService
    svc = ExploreService(get_settings())
    r = await svc.search(SearchRequest(q=q))
    data = json.loads(r.model_dump_json())
    print("Entendi:", {k: v for k, v in data["intent"].items() if v not in (None, [], False, "")})
    show(data["providers"], data["items"])


def remote(api: str, q: str):
    r = httpx.post(f"{api.rstrip('/')}/api/explore/search", json={"q": q}, timeout=60)
    r.raise_for_status()
    data = r.json()
    show(data["providers"], data["items"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("q", nargs="?", default="o que fazer no fim de semana")
    ap.add_argument("--api", help="URL do backend publicado (senão roda localmente)")
    a = ap.parse_args()
    remote(a.api, a.q) if a.api else asyncio.run(local(a.q))
