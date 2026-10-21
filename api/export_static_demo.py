"""Export the existing deterministic match for a zero-cost static web preview.

This is precomputed fictional data, not live events or Microsoft Foundry output.
Run at repository root: python -m api.export_static_demo
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from api.simulator import build_match
from api.analytics import detect_insights
from api.overlays import build_overlay_cues


DEFAULT_OUTPUT = Path("web/public/demo-match.json")


def create_snapshot() -> dict:
    match = build_match()
    insights = detect_insights(match["events"])
    return {**match, "insights": insights, "overlays": build_overlay_cues(match, insights)}


def export_snapshot(output: Path = DEFAULT_OUTPUT) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(create_snapshot(), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(f"Wrote deterministic, synthetic match snapshot to {export_snapshot(args.output)}")
