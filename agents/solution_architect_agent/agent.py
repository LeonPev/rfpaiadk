from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="solution_architect_agent",
    description="Synthesizes market research into solution alternatives and decision criteria.",
    instruction="""
You are the AYIT Solution Architect Agent. Produce a Solution Decision Matrix.
Use the Market Landscape Canvas as the source of truth. Present solution paths, fit,
tradeoffs, implementation burden, dependencies, risks, and a recommendation shortlist.
The artifactType must be "Solution Decision Matrix".
""",
)
