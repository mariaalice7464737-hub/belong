"""Configuração por variáveis de ambiente (nunca coloque chaves no código)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv() -> None:
    """Lê backend/.env (se existir) sem dependências extras. Variáveis já definidas têm prioridade."""
    env = Path(__file__).resolve().parents[2] / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _csv(name: str, default: str) -> list[str]:
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    google_places_api_key: str | None = field(default_factory=lambda: os.environ.get("GOOGLE_PLACES_API_KEY") or None)
    ticketmaster_api_key: str | None = field(default_factory=lambda: os.environ.get("TICKETMASTER_API_KEY") or None)
    # Cidade padrão (centro da busca) e fuso local.
    city: str = field(default_factory=lambda: os.environ.get("EXPLORE_CITY", "Cape Town"))
    country_code: str = field(default_factory=lambda: os.environ.get("EXPLORE_COUNTRY_CODE", "ZA"))
    center_lat: float = field(default_factory=lambda: float(os.environ.get("EXPLORE_CENTER_LAT", "-33.9058")))
    center_lon: float = field(default_factory=lambda: float(os.environ.get("EXPLORE_CENTER_LON", "18.4097")))
    timezone: str = field(default_factory=lambda: os.environ.get("EXPLORE_TIMEZONE", "Africa/Johannesburg"))
    search_radius_km: float = field(default_factory=lambda: float(os.environ.get("EXPLORE_RADIUS_KM", "25")))
    cache_ttl_seconds: int = field(default_factory=lambda: int(os.environ.get("EXPLORE_CACHE_TTL", "600")))
    http_timeout: float = field(default_factory=lambda: float(os.environ.get("EXPLORE_HTTP_TIMEOUT", "8")))
    cors_origins: list[str] = field(default_factory=lambda: _csv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://mariaalice7464737-hub.github.io"))
    fx_enabled: bool = field(default_factory=lambda: os.environ.get("EXPLORE_FX", "1") != "0")


def get_settings() -> Settings:
    return Settings()
