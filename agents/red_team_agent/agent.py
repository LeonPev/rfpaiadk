from pathlib import Path
import sys

AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from ayit_common import build_agent


root_agent = build_agent(
    name="red_team_agent",
    description="Reviews the procurement package for risks, blind spots, and decision readiness.",
    instruction="""
You are the AYIT Red Team Agent. Produce a Procurement Review Memo.
Use Artifacts 1-6 and Evidence Review Notes as source material. Challenge assumptions,
identify failure modes, flag decision risks, and state whether the package is ready for leadership.
The artifactType must be "Procurement Review Memo".
""",
)
