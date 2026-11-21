"""API do Cape Town Editorial.

Rodar (dentro de backend/):
    uvicorn app.main:app --reload --port 8000

Documentação interativa: http://localhost:8000/docs
"""
from __future__ import annotations

import io
import json
import mimetypes
import re
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from . import db
from .budget import compute_budget

APP_DIR = Path(__file__).resolve().parent
GUIDE_PATH = APP_DIR / "data" / "guide.json"

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB por arquivo
ALLOWED_TYPES = ("image/", "application/pdf")
FILE_KINDS = {"document", "room"}  # "room" = foto do quarto (só uma)
FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")

db.init()

app = FastAPI(title="Cape Town Editorial API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_guide() -> dict[str, Any]:
    """Lido a cada requisição: edite guide.json e é só recarregar a página."""
    with GUIDE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


# ---------- conteúdo e estado ----------

@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/guide")
def get_guide() -> dict[str, Any]:
    return load_guide()


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return db.get_state()


@app.patch("/api/state")
def patch_state(changes: dict[str, Any]) -> dict[str, Any]:
    db.update_state(changes)
    return db.get_state()


@app.get("/api/budget")
def get_budget() -> dict[str, Any]:
    return compute_budget(load_guide(), db.get_state())


# ---------- anexos ----------

def doc_category_ids() -> set[str]:
    return {c["id"] for c in load_guide()["doc_categories"]}


@app.get("/api/files")
def list_files(category: Optional[str] = None) -> list[dict[str, Any]]:
    return db.list_files(category=category)


@app.post("/api/files", status_code=201)
async def upload_files(
    files: list[UploadFile] = File(...),
    kind: str = Form("document"),
    category: str = Form("outros"),
) -> list[dict[str, Any]]:
    if kind not in FILE_KINDS:
        raise HTTPException(400, f"kind deve ser um de {sorted(FILE_KINDS)}")
    if category not in doc_category_ids():
        raise HTTPException(400, f"Categoria desconhecida: {category}")

    saved = []
    for upload in files:
        name = upload.filename or "arquivo"
        ctype = upload.content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
        if not ctype.startswith(ALLOWED_TYPES):
            raise HTTPException(415, f"Tipo não suportado: {name} (use imagem ou PDF)")
        data = await upload.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"Arquivo acima de 10 MB: {name}")

        if kind == "room":  # só guarda uma foto do quarto
            for old in db.list_files(kind="room"):
                db.delete_file(old["id"])

        file_id = uuid.uuid4().hex
        (db.UPLOAD_DIR / file_id).write_bytes(data)
        saved.append(db.add_file(file_id, name, ctype, kind, len(data), category=category))
    return saved


@app.get("/api/files/zip")
def download_category(category: str) -> StreamingResponse:
    """Baixa todos os anexos de uma pasta num .zip, com os nomes originais."""
    if category not in doc_category_ids():
        raise HTTPException(400, f"Categoria desconhecida: {category}")
    files = [f for f in db.list_files(category=category) if f["kind"] == "document"]
    if not files:
        raise HTTPException(404, "Essa pasta ainda não tem anexos")
    buf = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            path = db.UPLOAD_DIR / f["id"]
            if not path.exists():
                continue
            name = Path(f["name"]).name or "arquivo"
            stem, suffix = Path(name).stem, Path(name).suffix
            n = 2
            while name in used:
                name = f"{stem} ({n}){suffix}"
                n += 1
            used.add(name)
            zf.write(path, name)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="documentos_{category}.zip"'},
    )


@app.get("/api/files/{file_id}")
def get_file(file_id: str, download: bool = False) -> FileResponse:
    record = db.get_file(file_id)
    path = db.UPLOAD_DIR / file_id
    if not record or not path.exists():
        raise HTTPException(404, "Arquivo não encontrado")
    return FileResponse(
        path,
        media_type=record["content_type"],
        filename=record["name"],
        content_disposition_type="attachment" if download else "inline",
    )


@app.delete("/api/files/{file_id}", status_code=204)
def delete_file(file_id: str) -> None:
    if not db.get_file(file_id):
        raise HTTPException(404, "Arquivo não encontrado")
    db.delete_file(file_id)


# ---------- backup ----------

@app.get("/api/backup")
def export_backup() -> StreamingResponse:
    """Um .zip com tudo: estado, lista de anexos e os próprios arquivos."""
    buf = io.BytesIO()
    files = db.list_files()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("state.json", json.dumps(db.get_state(), ensure_ascii=False, indent=2))
        zf.writestr("files.json", json.dumps(files, ensure_ascii=False, indent=2))
        for f in files:
            path = db.UPLOAD_DIR / f["id"]
            if path.exists():
                zf.write(path, f"uploads/{f['id']}")
    buf.seek(0)
    stamp = time.strftime("%Y-%m-%d")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="cape_town_editorial_backup_{stamp}.zip"'},
    )


@app.post("/api/backup")
async def import_backup(file: UploadFile = File(...)) -> dict[str, int]:
    """Substitui tudo pelo conteúdo do backup."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(await file.read()))
        state = json.loads(zf.read("state.json"))
        files = json.loads(zf.read("files.json"))
        if not isinstance(state, dict) or not isinstance(files, list):
            raise ValueError
    except Exception:
        raise HTTPException(400, "Backup inválido: envie o .zip exportado pelo app")

    db.replace_state(state)
    db.delete_all_files()
    restored = 0
    for f in files:
        fid = str(f.get("id", ""))
        if not FILE_ID_RE.match(fid) or f"uploads/{fid}" not in zf.namelist():
            continue
        data = zf.read(f"uploads/{fid}")
        (db.UPLOAD_DIR / fid).write_bytes(data)
        db.add_file(fid, f.get("name", "arquivo"), f.get("content_type", "application/octet-stream"),
                    f.get("kind", "document"), len(data), f.get("created_at"),
                    category=f.get("category", "outros"))
        restored += 1
    return {"keys": len(state), "files": restored}
