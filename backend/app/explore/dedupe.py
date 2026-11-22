"""Remoção de duplicados: mesmo identificador externo, ou mesmo título + data + local."""
from __future__ import annotations

from .parser import normalize
from .schemas import Experience


def _key(e: Experience) -> str:
    day = e.schedule.start.date().isoformat() if e.schedule.start else "-"
    place = normalize(e.location.venue or e.location.address or "")[:40]
    title = normalize(e.name)
    return f"{title}|{day}|{place}"


def dedupe(items: list[Experience]) -> list[Experience]:
    seen_ids: set[str] = set()
    seen_keys: dict[str, Experience] = {}
    out: list[Experience] = []
    for e in items:
        ext = f"{e.source.provider}:{e.source.external_id}" if e.source.external_id else e.id
        if ext in seen_ids:
            continue
        k = _key(e)
        if k in seen_keys:
            # Fica a versão mais confiável (verificada > provider) ou a mais completa.
            prev = seen_keys[k]
            rank = {"verified": 2, "provider": 1, "unverified": 0}
            better = rank[e.source.verification] > rank[prev.source.verification] or (
                rank[e.source.verification] == rank[prev.source.verification]
                and sum(v is not None for v in e.model_dump().values()) > sum(v is not None for v in prev.model_dump().values()))
            if better:
                out[out.index(prev)] = e
                seen_keys[k] = e
            seen_ids.add(ext)
            continue
        seen_ids.add(ext)
        seen_keys[k] = e
        out.append(e)
    return out
