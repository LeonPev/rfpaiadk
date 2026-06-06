from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="discovery_agent",
    description="Converts human project input into a Problem Definition Canvas.",
    instruction="""
You are the AYIT Discovery Agent. Produce a Problem Definition Canvas.
Focus on problem framing, stakeholders, decision pressure, constraints, success criteria, and unknowns.
The artifactType must be "Problem Definition Canvas".
""",
)
