"""Orquestração da busca: providers → validação → deduplicação → filtros → ranking → paginação."""
from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx

from . import fx, store
from .cache import TTLCache
from .categories import BY_ID, NEIGHBORHOODS
from .dedupe import dedupe
from .normalize import haversine_km
from .parser import IntentEnhancer, normalize, parse
from .providers import Provider, SearchContext, default_providers
from .providers.base import ProviderError
from .ranking import score
from .schemas import Experience, Filters, Intent, ProviderStatus, SearchRequest, SearchResponse

# Faixas de preço em rand (ZAR) por pessoa. Para outras moedas usa só o "nível" do Google.
PRICE_BANDS_ZAR = {"budget": (0, 200), "mid": (0, 500), "premium": (500, float("inf"))}
PRICE_LEVEL_MAX = {"free": 0, "budget": 1, "mid": 2, "premium": 4}
NEIGHBORHOOD_RADIUS_KM = 3.0


def preset_range(preset: str | None, today: date) -> tuple[date | None, date | None]:
    if preset == "today":
        return today, today
    if preset == "tomorrow":
        d = today + timedelta(days=1)
        return d, d
    if preset == "weekend":
        if today.weekday() == 6:
            return today, today
        sat = today + timedelta(days=(5 - today.weekday()) % 7)
        return sat, sat + timedelta(days=1)
    if preset == "week":
        return today, today + timedelta(days=6)
    return None, None


def _days_in(d1: date, d2: date) -> set[int]:
    days, d = set(), d1
    while d <= d2 and len(days) < 7:
        days.add(d.weekday())
        d += timedelta(days=1)
    return days


def neighborhood_center(name: str | None) -> tuple[float, float] | None:
    if not name:
        return None
    n = normalize(name)
    for key, (label, lat, lon) in NEIGHBORHOODS.items():
        if n in (key, normalize(label)):
            return lat, lon
    return None


class ExploreService:
    def __init__(self, settings, providers: list[Provider] | None = None, enhancer: IntentEnhancer | None = None,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self.providers = providers if providers is not None else default_providers(settings)
        self.enhancer = enhancer
        self.transport = transport
        self.cache = TTLCache(ttl=settings.cache_ttl_seconds)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.settings.http_timeout, transport=self.transport,
                                 headers={"User-Agent": "Belong-Explore/1.0"})

    def statuses(self) -> list[ProviderStatus]:
        return [p.status() for p in self.providers]

    def provider(self, pid: str) -> Provider | None:
        return next((p for p in self.providers if p.id == pid), None)

    # ---------- busca ----------
    async def search(self, req: SearchRequest, now: datetime | None = None) -> SearchResponse:
        tz = ZoneInfo(self.settings.timezone)
        now = (now or datetime.now(tz)).astimezone(tz)
        today = now.date()
        f: Filters = req.filters
        intent: Intent = parse(req.q, now=now, tz=self.settings.timezone, enhancer=self.enhancer)
        warnings: list[str] = []

        # Filtros explícitos têm prioridade sobre o que o parser entendeu.
        category = f.category or intent.category
        if f.category and f.category not in BY_ID:
            warnings.append(f"Categoria desconhecida: {f.category}")
            category = intent.category
        d_from, d_to = (f.date_from, f.date_to or f.date_from) if f.date == "custom" or f.date_from else preset_range(f.date, today)
        if not d_from:
            d_from, d_to = intent.date_from, intent.date_to
        if d_from and d_to and d_to < d_from:
            d_from, d_to = d_to, d_from

        # Ponto de referência: sua localização > bairro (filtro ou busca) > centro da cidade.
        user_point = (req.lat, req.lon) if req.lat is not None and req.lon is not None else None
        hood_name = f.neighborhood or intent.neighborhood
        hood_point = neighborhood_center(hood_name)
        if hood_name and not hood_point:
            warnings.append(f"Bairro não reconhecido: {hood_name}")
        center = user_point or hood_point or (self.settings.center_lat, self.settings.center_lon)
        reference = user_point or hood_point  # distância só quando há localização de verdade

        start = datetime.combine(d_from, time.min, tz) if d_from else None
        end = datetime.combine(d_to, time.max, tz) if d_to else None
        radius = f.max_distance_km or (NEIGHBORHOOD_RADIUS_KM * 2 if hood_point and not user_point else self.settings.search_radius_km)

        statuses = self.statuses()
        items: list[Experience] = []
        async with self.client() as client:
            ctx = SearchContext(intent=intent, category=category, center_lat=center[0], center_lon=center[1],
                                radius_km=radius, start=start, end=end, limit=20, client=client, now=now)
            active = [(p, s) for p, s in zip(self.providers, statuses) if s.enabled]
            results = await asyncio.gather(*(self._run(p, ctx, req) for p, _ in active), return_exceptions=True)
            for (p, s), res in zip(active, results):
                if isinstance(res, Exception):
                    s.ok, s.count, s.error = False, 0, str(res) or res.__class__.__name__
                    warnings.append(f"{p.name} indisponível agora ({s.error}).")
                else:
                    s.ok, s.count = True, len(res)
                    items.extend(res)

            # Validação: tira eventos que já passaram; datas sem confirmação não contam como evento datado.
            valid = []
            for e in items:
                if e.type == "event" and e.schedule.start and e.schedule.date_confirmed:
                    if e.schedule.start.astimezone(tz).date() < today:
                        continue
                valid.append(e)
            items = dedupe(valid)

            # Distância só com ponto de referência.
            for e in items:
                if reference and e.location.lat is not None and e.location.lon is not None:
                    e.location.distance_km = round(haversine_km(reference[0], reference[1], e.location.lat, e.location.lon), 2)

            items = [e for e in items if self._passes(e, f, category if f.category else None, d_from, d_to,
                                                         hood_point if f.neighborhood else None, reference)]
            for e in items:
                e.score = score(e, intent, category, d_from, d_to, reference is not None)
            items.sort(key=lambda e: (-(e.score or 0), e.schedule.start.timestamp() if e.schedule.start else float("inf"), e.name))

            total = len(items)
            first = (req.page - 1) * req.page_size
            page_items = items[first: first + req.page_size]
            if self.settings.fx_enabled:
                await self._convert(page_items, client)
        store.remember(page_items)

        intent.date_from, intent.date_to = d_from, d_to
        intent.category = category
        if not any(s.enabled for s in statuses):
            warnings.append("Nenhuma fonte de dados está ativa.")
        return SearchResponse(items=page_items, total=total, page=req.page, page_size=req.page_size,
                              has_more=first + req.page_size < total, intent=intent, providers=statuses, warnings=warnings)

    async def _run(self, p: Provider, ctx: SearchContext, req: SearchRequest) -> list[Experience]:
        key = f"{p.id}|{ctx.intent.activity}|{','.join(ctx.intent.keywords)}|{ctx.category}|{ctx.center_lat:.3f},{ctx.center_lon:.3f}|{ctx.radius_km}|{ctx.start}|{ctx.end}"
        hit = self.cache.get(key) if p.id != "belong" else None
        if hit is not None:
            return [e.model_copy(deep=True) for e in hit]
        try:
            res = await p.search(ctx)
        except ProviderError:
            raise
        except httpx.HTTPError as e:
            raise ProviderError(f"falha de rede: {e.__class__.__name__}") from e
        if p.id != "belong":
            self.cache.set(key, res)
        return [e.model_copy(deep=True) for e in res]

    def _passes(self, e: Experience, f: Filters, category: str | None, d_from: date | None, d_to: date | None,
                hood_point: tuple[float, float] | None, reference) -> bool:
        if f.types and e.type not in f.types:
            return False
        if category and e.category != category:
            return False
        if d_from:
            d_to = d_to or d_from
            if e.type == "event":
                if not (e.schedule.start and e.schedule.date_confirmed):
                    return False
                if not (d_from <= e.schedule.start.date() <= d_to):
                    return False
            elif e.type == "recurring":
                s = e.schedule
                if s.season_end and d_from > s.season_end or s.season_start and d_to < s.season_start:
                    return False
                if s.recurrence_days is not None and not (_days_in(d_from, d_to) & set(s.recurrence_days)):
                    return False
        if hood_point:
            same = e.location.neighborhood and neighborhood_center(e.location.neighborhood) == hood_point
            near = (e.location.lat is not None and e.location.lon is not None and
                    haversine_km(hood_point[0], hood_point[1], e.location.lat, e.location.lon) <= NEIGHBORHOOD_RADIUS_KM)
            if not (same or near):
                return False
        if f.max_distance_km:
            if not reference or e.location.distance_km is None or e.location.distance_km > f.max_distance_km:
                return False
        if f.price:
            if not self._price_ok(e, f.price):
                return False
        if f.outdoor is not None and e.outdoor != f.outdoor:
            return False
        return True

    @staticmethod
    def _price_ok(e: Experience, band: str) -> bool:
        p = e.price
        if band == "free":
            return bool(p.is_free or (p.min == 0 and (p.max in (0, None))) or p.level == 0)
        if p.min is not None and (p.currency or "").upper() == "ZAR":
            lo, hi = PRICE_BANDS_ZAR[band]
            return lo <= p.min <= hi if band != "premium" else p.min >= lo
        if p.is_free:
            return band != "premium"
        if p.level is not None:
            return p.level <= PRICE_LEVEL_MAX[band] if band != "premium" else p.level >= 3
        return False  # preço não informado: não dá para garantir a faixa

    async def _convert(self, items: list[Experience], client: httpx.AsyncClient) -> None:
        for cur in {e.price.currency for e in items if e.price.currency and (e.price.min is not None or e.price.max is not None)}:
            r = await fx.rate_to_brl(cur, client)
            if not r:
                continue
            rate, when = r
            for e in items:
                if e.price.currency == cur:
                    e.price.fx_rate, e.price.fx_date = round(rate, 6), when
                    e.price.brl_min = round(e.price.min * rate, 2) if e.price.min is not None else None
                    e.price.brl_max = round(e.price.max * rate, 2) if e.price.max is not None else None

    # ---------- detalhe ----------
    async def get(self, experience_id: str) -> Experience | None:
        hit = store.recent.get(experience_id)
        if hit:
            return hit
        pid, _, ext = experience_id.partition(":")
        p = self.provider(pid)
        if not p or not ext or not p.status().enabled:
            return None
        async with self.client() as client:
            try:
                e = await p.get(ext, client)
            except httpx.HTTPError:
                return None
        if e:
            store.remember([e])
        return e
