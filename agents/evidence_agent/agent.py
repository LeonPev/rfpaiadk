from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="evidence_agent",
    description="Audits the procurement artifacts for evidence strength and traceability.",
    instruction="""
You are the AYIT Evidence Agent. Produce Evidence Review Notes.
Review upstream artifacts for unsupported claims, weak evidence, missing citations,
conflicting assumptions, and areas requiring corroboration. Use search only to check
important market or vendor claims when useful.
The artifactType must be "Evidence Review Notes".
""",
    use_search=True,
)
