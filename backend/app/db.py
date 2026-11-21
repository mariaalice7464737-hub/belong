"""Persistência em SQLite.

Duas tabelas:
- state: pares chave → valor (JSON) com tudo o que você preenche no app
  (checkboxes, anotações, preços, câmbio...).
- files: metadados dos anexos. O conteúdo fica em storage/uploads/<id>.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
DB_PATH = STORAGE_DIR / "dossier.db"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS state (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                content_type TEXT NOT NULL,
                kind         TEXT NOT NULL DEFAULT 'document',
                category     TEXT NOT NULL DEFAULT 'outros',
                size         INTEGER NOT NULL,
                created_at   REAL NOT NULL
            );
            """
        )
        # migração: bancos antigos não tinham a coluna category
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(files)")}
        if "category" not in cols:
            conn.execute("ALTER TABLE files ADD COLUMN category TEXT NOT NULL DEFAULT 'outros'")


# ---------- state ----------

def get_state() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute("SELECT key, value FROM state").fetchall()
    return {r["key"]: json.loads(r["value"]) for r in rows}


def update_state(changes: dict[str, Any]) -> None:
    """Grava as chaves recebidas. Valor None apaga a chave."""
    with connect() as conn:
        for key, value in changes.items():
            if value is None:
                conn.execute("DELETE FROM state WHERE key = ?", (key,))
            else:
                conn.execute(
                    "INSERT INTO state (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, json.dumps(value, ensure_ascii=False)),
                )


def replace_state(new_state: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM state")
    update_state(new_state)


# ---------- files ----------

def _file_row(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def list_files(kind: str | None = None, category: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM files"
    where, params = [], []
    if kind:
        where.append("kind = ?"); params.append(kind)
    if category:
        where.append("category = ?"); params.append(category)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at"
    with connect() as conn:
        return [_file_row(r) for r in conn.execute(sql, tuple(params)).fetchall()]


def get_file(file_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    return _file_row(row) if row else None


def add_file(file_id: str, name: str, content_type: str, kind: str, size: int,
             created_at: float | None = None, category: str = "outros") -> dict[str, Any]:
    record = {
        "id": file_id,
        "name": name,
        "content_type": content_type,
        "kind": kind,
        "category": category,
        "size": size,
        "created_at": created_at or time.time(),
    }
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO files (id, name, content_type, kind, category, size, created_at) "
            "VALUES (:id, :name, :content_type, :kind, :category, :size, :created_at)",
            record,
        )
    return record


def delete_file(file_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
    (UPLOAD_DIR / file_id).unlink(missing_ok=True)


def delete_all_files() -> None:
    for f in list_files():
        delete_file(f["id"])
