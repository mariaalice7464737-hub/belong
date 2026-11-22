"""Persistência do Explore.

- Experiências vistas recentemente (para GET /experiences/{id}): só em memória, com prazo.
- Favoritos por dispositivo (cabeçalho X-Device-Id) em SQLite, no mesmo banco do app.
  Sem login, cada aparelho tem seus favoritos. Em produção persistente, use PostgreSQL (ver README).
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone

from .. import db
from .cache import TTLCache
from .schemas import Experience, Favorite

recent = TTLCache(ttl=30 * 60, max_items=2000)
DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def remember(items: list[Experience]) -> None:
    for e in items:
        recent.set(e.id, e)


def init() -> None:
    db.init()
    with db.connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS explore_favorites (
                   device_id     TEXT NOT NULL,
                   experience_id TEXT NOT NULL,
                   experience    TEXT NOT NULL,
                   created_at    REAL NOT NULL,
                   PRIMARY KEY (device_id, experience_id)
               )"""
        )


def valid_device(device_id: str | None) -> bool:
    return bool(device_id and DEVICE_RE.match(device_id))


def list_favorites(device_id: str) -> list[Favorite]:
    with db.connect() as conn:
        rows = conn.execute("SELECT experience_id, experience, created_at FROM explore_favorites "
                            "WHERE device_id = ? ORDER BY created_at DESC", (device_id,)).fetchall()
    return [Favorite(id=r["experience_id"], experience=Experience.model_validate_json(r["experience"]),
                     created_at=datetime.fromtimestamp(r["created_at"], timezone.utc)) for r in rows]


def save_favorite(device_id: str, e: Experience) -> Favorite:
    now = time.time()
    with db.connect() as conn:
        conn.execute("INSERT INTO explore_favorites (device_id, experience_id, experience, created_at) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(device_id, experience_id) DO UPDATE SET experience = excluded.experience",
                     (device_id, e.id, e.model_dump_json(), now))
    return Favorite(id=e.id, experience=e, created_at=datetime.fromtimestamp(now, timezone.utc))


def delete_favorite(device_id: str, experience_id: str) -> bool:
    with db.connect() as conn:
        cur = conn.execute("DELETE FROM explore_favorites WHERE device_id = ? AND experience_id = ?",
                           (device_id, experience_id))
    return cur.rowcount > 0
