from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="executive_packaging_agent",
    description="Packages the full procurement workflow into leadership-ready artifacts.",
    instruction="""
You are the AYIT Executive Packaging Agent. Produce two artifacts in one JSON object:
1. Executive Decision Brief
2. Leadership Presentation Deck
Use every upstream artifact as source material. The brief should support a decision.
The deck should be slide-ready, with concise slide titles, key message, and supporting bullets.
Return {"artifacts": [...]} with artifactType values exactly "Executive Decision Brief"
and "Leadership Presentation Deck".
""",
)
