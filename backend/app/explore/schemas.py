"""Contrato da API do Explore. Campos ausentes ficam None: nunca são inventados."""
from __future__ import annotations

from datetime import date as Date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ExperienceType = Literal["event", "recurring", "place"]
Verification = Literal["verified", "provider", "unverified"]
PriceBand = Literal["free", "budget", "mid", "premium"]
DatePreset = Literal["today", "tomorrow", "weekend", "week", "custom"]


class Price(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    currency: Optional[str] = None           # moeda original (ex.: ZAR)
    is_free: Optional[bool] = None
    level: Optional[int] = None              # 0–4, quando a fonte só informa uma faixa (Google)
    brl_min: Optional[float] = None          # só preenchido com câmbio disponível
    brl_max: Optional[float] = None
    fx_rate: Optional[float] = None
    fx_date: Optional[str] = None


class Location(BaseModel):
    venue: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    distance_km: Optional[float] = None
    maps_url: Optional[str] = None


class Schedule(BaseModel):
    start: Optional[datetime] = None         # com fuso
    end: Optional[datetime] = None
    timezone: Optional[str] = None
    date_confirmed: bool = False             # True só quando a fonte informa data
    time_confirmed: bool = False             # True só quando a fonte informa horário
    recurrence: Optional[str] = None         # texto: "Sábados, 8h" (atividades recorrentes)
    recurrence_days: Optional[list[int]] = None  # 0=segunda … 6=domingo, quando a fonte confirma
    season_start: Optional[Date] = None      # temporada (ex.: concertos de verão), se confirmada
    season_end: Optional[Date] = None


class Links(BaseModel):
    website: Optional[str] = None
    tickets: Optional[str] = None
    instagram: Optional[str] = None


class Source(BaseModel):
    provider: str
    external_id: Optional[str] = None
    url: Optional[str] = None
    fetched_at: datetime
    verification: Verification = "provider"


class Experience(BaseModel):
    id: str                                  # "<provider>:<external_id>"
    type: ExperienceType
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    location: Location = Field(default_factory=Location)
    schedule: Schedule = Field(default_factory=Schedule)
    price: Price = Field(default_factory=Price)
    image: Optional[str] = None
    links: Links = Field(default_factory=Links)
    outdoor: Optional[bool] = None
    source: Source
    score: Optional[float] = None


class Filters(BaseModel):
    date: Optional[DatePreset] = None
    date_from: Optional[Date] = None
    date_to: Optional[Date] = None
    neighborhood: Optional[str] = None
    max_distance_km: Optional[float] = Field(default=None, gt=0, le=100)
    price: Optional[PriceBand] = None
    category: Optional[str] = None
    outdoor: Optional[bool] = None
    types: Optional[list[ExperienceType]] = None


class SearchRequest(BaseModel):
    q: str = Field(default="", max_length=300)
    filters: Filters = Field(default_factory=Filters)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    page: int = Field(default=1, ge=1, le=50)
    page_size: int = Field(default=12, ge=1, le=50)

    @field_validator("q")
    @classmethod
    def strip_q(cls, v: str) -> str:
        return " ".join(v.split())


class Intent(BaseModel):
    """O que o parser entendeu da busca (devolvido ao frontend para transparência)."""
    text: str = ""
    keywords: list[str] = Field(default_factory=list)
    activity: Optional[str] = None
    category: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    date_from: Optional[Date] = None
    date_to: Optional[Date] = None
    date_label: Optional[str] = None
    outdoor: Optional[bool] = None
    social: Optional[Literal["social", "solo"]] = None
    price: Optional[PriceBand] = None
    wants_events: bool = False


class ProviderStatus(BaseModel):
    id: str
    name: str
    enabled: bool
    reason: Optional[str] = None
    ok: Optional[bool] = None                # resultado da última consulta nesta busca
    count: Optional[int] = None
    error: Optional[str] = None


class SearchResponse(BaseModel):
    items: list[Experience]
    total: int
    page: int
    page_size: int
    has_more: bool
    intent: Intent
    providers: list[ProviderStatus]
    warnings: list[str] = Field(default_factory=list)


class Category(BaseModel):
    id: str
    label: str
    label_en: str
    icon: str


class FavoriteIn(BaseModel):
    experience: Experience


class Favorite(BaseModel):
    id: str
    experience: Experience
    created_at: datetime
