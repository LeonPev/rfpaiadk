from __future__ import annotations

import os
from pathlib import Path

from ayit_env import configure_google_env
from google.adk.agents import Agent
from document_rag import search_uploaded_docs


configure_google_env(Path(__file__).resolve().parents[1])

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


def _agent_tools(use_search: bool):
    tools = [search_uploaded_docs]
    if not use_search:
        return tools
    try:
        from google.adk.tools.google_search_tool import GoogleSearchTool

        tools.append(GoogleSearchTool(bypass_multi_tools_limit=True))
    except Exception:
        tools.extend(_search_tools(use_search))
    return tools


def build_agent(name: str, description: str, instruction: str, use_search: bool = False):
    return Agent(
        model=AYIT_MODEL,
        name=name,
        description=description,
        instruction=f"""{instruction}

You can call search_uploaded_docs to search documents uploaded by the Human User. When you use those snippets, cite the uploaded filename in the artifact text.

{JSON_CONTRACT}""",
        tools=_agent_tools(use_search),
    )
