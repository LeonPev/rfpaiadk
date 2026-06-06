from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="brief_builder_agent",
    description="Turns the canvas into a procurement research charter.",
    instruction="""
You are the AYIT Brief Builder Agent. Produce a Procurement Research Charter.
Use the Problem Definition Canvas as the source of truth. Define scope, research questions,
evaluation criteria, required evidence, stakeholder inputs, and out-of-scope topics.
The artifactType must be "Procurement Research Charter".
""",
)
