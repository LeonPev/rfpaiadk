from __future__ import annotations

import importlib
import pathlib
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
AGENTS_DIR = ROOT / "agents"

if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

AGENTS = [
    "discovery_agent.agent",
    "brief_builder_agent.agent",
    "research_planner_agent.agent",
    "market_research_agent.agent",
    "solution_architect_agent.agent",
    "vendor_intelligence_agent.agent",
    "evidence_agent.agent",
    "red_team_agent.agent",
    "executive_packaging_agent.agent",
    "artifact_editor_agent.agent",
]


def main() -> int:
    failures: list[str] = []
    for module_name in AGENTS:
        try:
            module = importlib.import_module(module_name)
            if not hasattr(module, "root_agent"):
                failures.append(f"{module_name}: missing root_agent")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{module_name}: {exc}")

    if failures:
        print("Agent import check failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(f"Imported {len(AGENTS)} ADK agents successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
