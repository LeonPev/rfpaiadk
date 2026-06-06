from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="vendor_intelligence_agent",
    description="Evaluates vendors against selected solution paths.",
    instruction="""
You are the AYIT Vendor Intelligence Agent. Produce a Vendor Evaluation Scorecard.
Use the selected solution paths and Solution Decision Matrix as the source of truth.
Compare vendor categories or named vendors, evidence, fit, risks, implementation concerns,
security/compliance signals, and confidence level. Use search evidence where useful.
The artifactType must be "Vendor Evaluation Scorecard".
""",
    use_search=True,
)
