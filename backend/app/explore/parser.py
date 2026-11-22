"""Interpretação da busca em linguagem natural (PT/EN), por regras determinísticas.

Exemplo: "Quero uma festa de afro house sábado perto de Sea Point"
→ categoria music-night, atividade "afro house", data = próximo sábado (fuso local), bairro Sea Point.

A interface `IntentEnhancer` permite plugar um modelo de linguagem no futuro. Ele só pode
REFINAR a interpretação (campos do Intent); nunca gera eventos, preços ou lugares.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from .categories import (ACTIVITIES, BUDGET_WORDS, BY_ID, CATEGORIES, EVENT_WORDS, FREE_WORDS, INDOOR_WORDS,
                         NEIGHBORHOODS, OUTDOOR_WORDS, PREMIUM_WORDS, SOCIAL_WORDS, SOLO_WORDS)
from .schemas import Intent

WEEKDAYS = {
    # segunda=0 … domingo=6
    "segunda": 0, "segunda-feira": 0, "monday": 0,
    "terca": 1, "terca-feira": 1, "tuesday": 1,
    "quarta": 2, "quarta-feira": 2, "wednesday": 2,
    "quinta": 3, "quinta-feira": 3, "thursday": 3,
    "sexta": 4, "sexta-feira": 4, "friday": 4,
    "sabado": 5, "saturday": 5,
    "domingo": 6, "sunday": 6,
}

WEEKDAY_LABEL = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]

STOPWORDS = set("""
quero queria procuro procurando busco buscando gostaria uma um umas uns de do da dos das no na nos nas em para pra pro
com sem que e ou o a os as por perto proximo proxima ao aos algo alguma algum lugar lugares onde ir fazer hoje amanha
esse essa este esta nesse nessa neste nesta semana fim final mes me i want looking for find a an the of in on at near
to some something place places where go do this next tonight today tomorrow weekend week and or with
""".split())


def normalize(text: str) -> str:
    """Minúsculas, sem acentos, espaços simples."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.split())


def _has(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", text) is not None


def _any(text: str, words: list[str]) -> bool:
    return any(_has(text, w) for w in words)


def _next_weekday(today: date, weekday: int) -> date:
    """Próxima ocorrência do dia da semana (hoje conta, se for o mesmo dia)."""
    return today + timedelta(days=(weekday - today.weekday()) % 7)


def parse_dates(text: str, today: date) -> tuple[date | None, date | None, str | None]:
    if _any(text, ["hoje a noite", "hoje", "today", "tonight", "esta noite"]):
        return today, today, "hoje"
    if _any(text, ["depois de amanha", "day after tomorrow"]):
        d = today + timedelta(days=2)
        return d, d, "depois de amanhã"
    if _any(text, ["amanha", "tomorrow"]):
        d = today + timedelta(days=1)
        return d, d, "amanhã"
    if _any(text, ["fim de semana", "final de semana", "weekend", "fds"]):
        sat = _next_weekday(today, 5)
        if today.weekday() == 6:  # domingo: o fim de semana é hoje
            return today, today, "fim de semana"
        return sat, sat + timedelta(days=1), "fim de semana"
    if _any(text, ["proxima semana", "semana que vem", "next week"]):
        start = today + timedelta(days=7 - today.weekday())
        return start, start + timedelta(days=6), "próxima semana"
    if _any(text, ["esta semana", "essa semana", "nesta semana", "this week"]):
        return today, today + timedelta(days=6 - today.weekday()), "esta semana"
    if _any(text, ["este mes", "esse mes", "this month"]):
        nxt = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        return today, nxt - timedelta(days=1), "este mês"
    for word, wd in WEEKDAYS.items():
        if _has(text, word):
            d = _next_weekday(today, wd)
            return d, d, WEEKDAY_LABEL[wd]
    m = re.search(r"\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b", text)
    if m:
        day, month = int(m.group(1)), int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        if year < 100:
            year += 2000
        try:
            d = date(year, month, day)
        except ValueError:
            return None, None, None
        if not m.group(3) and d < today:
            d = d.replace(year=today.year + 1)
        return d, d, d.strftime("%d/%m")
    return None, None, None


class IntentEnhancer(Protocol):
    """Gancho opcional para um modelo de linguagem refinar o Intent (não obrigatório)."""

    def enhance(self, text: str, intent: Intent) -> Intent: ...


def parse(text: str, now: datetime | None = None, tz: str = "Africa/Johannesburg",
          enhancer: IntentEnhancer | None = None) -> Intent:
    now = now or datetime.now(ZoneInfo(tz))
    today = now.astimezone(ZoneInfo(tz)).date() if now.tzinfo else now.date()
    t = normalize(text)
    intent = Intent(text=text)
    if not t:
        return intent

    # Atividade específica (frases mais longas primeiro: "afro house" antes de "house").
    for phrase in sorted(ACTIVITIES, key=len, reverse=True):
        if _has(t, phrase):
            cat, label, outdoor = ACTIVITIES[phrase]
            intent.activity, intent.category = label, cat
            if outdoor is not None:
                intent.outdoor = outdoor
            break

    # Categoria pela contagem de palavras-chave (se a atividade não definiu).
    if not intent.category:
        best, best_hits = None, 0
        for c in CATEGORIES:
            hits = sum(1 for k in c["keywords"] if _has(t, k))
            if hits > best_hits:
                best, best_hits = c["id"], hits
        intent.category = best

    # Bairro (o mais longo que aparecer).
    for key in sorted(NEIGHBORHOODS, key=len, reverse=True):
        if _has(t, key):
            intent.neighborhood = NEIGHBORHOODS[key][0]
            break
    if _any(t, ["cape town", "cidade do cabo", "capetown"]):
        intent.city = "Cape Town"

    intent.date_from, intent.date_to, intent.date_label = parse_dates(t, today)

    if _any(t, FREE_WORDS):
        intent.price = "free"
    elif _any(t, BUDGET_WORDS):
        intent.price = "budget"
    elif _any(t, PREMIUM_WORDS):
        intent.price = "premium"

    if intent.outdoor is None:
        if _any(t, OUTDOOR_WORDS):
            intent.outdoor = True
        elif _any(t, INDOOR_WORDS):
            intent.outdoor = False
    if _any(t, SOCIAL_WORDS):
        intent.social = "social"
    elif _any(t, SOLO_WORDS):
        intent.social = "solo"

    intent.wants_events = bool(intent.date_from) or _any(t, EVENT_WORDS)

    # Palavras-chave que sobram (para busca textual nos providers).
    removable = set()
    for key in NEIGHBORHOODS:
        if _has(t, key):
            removable.update(key.split())
    words = [w for w in re.findall(r"[a-z0-9&'-]+", t) if w not in STOPWORDS and w not in removable
             and w not in WEEKDAYS and not w.isdigit() and len(w) > 1]
    intent.keywords = list(dict.fromkeys(words))[:8]

    if enhancer is not None:
        try:
            intent = enhancer.enhance(text, intent)
        except Exception:  # o enhancer nunca pode derrubar a busca
            pass
    return intent


def category_label(cat_id: str | None) -> str | None:
    return BY_ID[cat_id]["label"] if cat_id in BY_ID else None
