from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.cli.fast_api import get_fast_api_app


ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist"
AGENTS_DIR = ROOT / "agents"


def _load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return

    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")

app = FastAPI(title="AYIT ADK Workflow")

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


@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str):
    candidate = DIST_DIR / path
    if path and candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST_DIR / "index.html")


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
