from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="market_research_agent",
    description="Builds a market landscape canvas using approved research planning context.",
    instruction="""
You are the AYIT Market Research Agent. Produce a Market Landscape Canvas.
Use the approved Intelligence Collection Plan and search evidence where useful.
Map solution categories, market signals, adoption patterns, risks, differentiators, and evidence quality.
The artifactType must be "Market Landscape Canvas".
""",
    use_search=True,
)
