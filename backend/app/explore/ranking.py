"""Relevância: atividade, categoria, período e preferências pesam mais; distância só com localização."""
from __future__ import annotations

from datetime import date

from .parser import normalize
from .schemas import Experience, Intent


def score(e: Experience, intent: Intent, category: str | None, date_from: date | None, date_to: date | None,
          has_reference_point: bool) -> float:
    s = 0.0
    hay = normalize(" ".join([e.name, e.description or "", " ".join(e.tags), e.location.venue or ""]))
    if intent.activity and normalize(intent.activity) in hay:
        s += 6
    s += sum(2 for k in intent.keywords if k in hay)
    if category and e.category == category:
        s += 3
    if intent.neighborhood and e.location.neighborhood and normalize(intent.neighborhood) == normalize(e.location.neighborhood):
        s += 3
    if date_from and e.type == "event" and e.schedule.start and e.schedule.date_confirmed:
        d = e.schedule.start.date()
        if date_from <= d <= (date_to or date_from):
            s += 4
    if intent.wants_events:
        s += {"event": 2, "recurring": 1, "place": -1}[e.type]
    if intent.outdoor is not None and e.outdoor is not None:
        s += 1.5 if e.outdoor == intent.outdoor else -1
    if intent.price == "free" and (e.price.is_free or e.price.min == 0):
        s += 2
    if has_reference_point and e.location.distance_km is not None:
        s += max(0.0, 3 - e.location.distance_km / 3)  # até +3 para o que está perto
    if e.source.verification == "verified":
        s += 1.5
    if e.image:
        s += 0.3
    return round(s, 3)
