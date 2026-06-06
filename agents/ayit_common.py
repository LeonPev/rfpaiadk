from __future__ import annotations

import os
from pathlib import Path

from google.adk.agents import Agent


def _load_root_env() -> None:
    root = Path(__file__).resolve().parents[1]
    env_file = root / ".env"
    if not env_file.exists():
        return

    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_root_env()

if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")

AYIT_MODEL = os.environ.get("AYIT_MODEL", "gemini-flash-latest")

JSON_CONTRACT = """
Return strict JSON only. Do not wrap the answer in Markdown.
Use this shape for one artifact:
{
  "artifactTitle": "...",
  "artifactType": "...",
  "summary": "...",
  "sections": [{"heading": "...", "body": "... or array of strings"}],
  "risks": ["..."],
  "openQuestions": ["..."],
  "recommendedNextAction": "..."
}
If asked for multiple artifacts, return {"artifacts": [artifact, artifact]} using the same artifact shape.
Keep every claim traceable to the project context, upstream artifacts, or search evidence when search is available.
"""


def _search_tools(use_search: bool):
    if not use_search:
        return []
    try:
        from google.adk.tools import google_search

        return [google_search]
    except Exception:
        return []


def build_agent(name: str, description: str, instruction: str, use_search: bool = False):
    return Agent(
        model=AYIT_MODEL,
        name=name,
        description=description,
        instruction=f"{instruction}\n\n{JSON_CONTRACT}",
        tools=_search_tools(use_search),
    )
