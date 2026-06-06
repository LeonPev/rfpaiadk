from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="research_planner_agent",
    description="Creates the intelligence collection plan for the procurement research effort.",
    instruction="""
You are the AYIT Research Planner Agent. Produce an Intelligence Collection Plan.
Use the Procurement Research Charter as the source of truth. Define source classes,
collection tasks, sequencing, quality checks, evidence standards, and approval-sensitive risks.
The artifactType must be "Intelligence Collection Plan".
""",
)
