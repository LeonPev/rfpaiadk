from __future__ import annotations

import os
import re
from pathlib import Path

from agents.ayit_env import configure_google_env
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from google.adk.cli.fast_api import get_fast_api_app

from agents.document_rag import delete_document, ingest_document, list_documents, read_markdown, retry_document


ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist"
AGENTS_DIR = ROOT / "agents"


configure_google_env(ROOT)

app = FastAPI(title="AYIT ADK Workflow")


def _extract_instruction(agent_file: Path) -> str:
    source = agent_file.read_text(encoding="utf-8")
    match = re.search(r"instruction\s*=\s*([\"']{3})([\s\S]*?)\1", source)
    if not match:
        return ""
    return match.group(2).strip()


def _load_agent_instructions() -> dict[str, str]:
    instructions: dict[str, str] = {}
    for agent_file in AGENTS_DIR.glob("*/agent.py"):
        app_name = agent_file.parent.name
        instructions[app_name] = _extract_instruction(agent_file)
    return instructions

adk_app = get_fast_api_app(
    agents_dir=str(AGENTS_DIR),
    web=False,
    host="0.0.0.0",
    port=int(os.environ.get("PORT", "8080")),
    use_local_storage=False,
    session_service_uri=os.environ.get("ADK_SESSION_SERVICE_URI", "memory://"),
    artifact_service_uri=os.environ.get("ADK_ARTIFACT_SERVICE_URI", "memory://"),
    memory_service_uri=os.environ.get("ADK_MEMORY_SERVICE_URI", "memory://"),
    allow_origins=["*"],
    default_llm_model=os.environ.get("AYIT_MODEL", "gemini-flash-latest"),
)

app.mount("/adk", adk_app)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/agent-instructions")
def agent_instructions():
    return _load_agent_instructions()


@app.get("/api/documents")
def documents():
    return {"documents": list_documents()}


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    filename = file.filename or "uploaded-document"
    try:
        content = await file.read()
        return {"document": ingest_document(filename, content)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/documents/{doc_id}/markdown")
def document_markdown(doc_id: str):
    try:
        return PlainTextResponse(read_markdown(doc_id), media_type="text/markdown; charset=utf-8")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/documents/{doc_id}/retry")
def retry_uploaded_document(doc_id: str):
    try:
        return {"document": retry_document(doc_id)}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/documents/{doc_id}")
def remove_document(doc_id: str):
    if not delete_document(doc_id):
        raise HTTPException(status_code=404, detail="Uploaded document not found.")
    return Response(status_code=204)


@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str):
    candidate = DIST_DIR / path
    if path and candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST_DIR / "index.html")


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
