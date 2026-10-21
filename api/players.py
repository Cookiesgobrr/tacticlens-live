"""Source-linked, time-scoped fictional player statistics."""
from __future__ import annotations


def player_stats(events: list[dict], player: str, at_second: int) -> dict:
    visible = [e for e in events if e["player"] == player and e["second"] <= at_second]
    passes = [e for e in visible if e["kind"] == "pass"]
    completed = [e for e in passes if e.get("pass_completed") is True]
    attempted = len(passes)
    return {
        "player": player,
        "at_second": at_second,
        "events": len(visible),
        "passes_attempted": attempted,
        "passes_completed": len(completed),
        "pass_accuracy_pct": round(len(completed) / attempted * 100) if attempted else None,
        "avg_pass_distance_m": round(sum(e["pass_distance_m"] for e in passes) / attempted, 1) if attempted else None,
        "avg_pass_difficulty": round(sum(e["pass_difficulty"] for e in passes) / attempted, 2) if attempted else None,
        "shots": sum(e["kind"] in {"shot", "goal"} for e in visible),
        "goals": sum(e["kind"] == "goal" for e in visible),
        "recoveries": sum(e["kind"] == "recovery" for e in visible),
        "evidence_ids": [e["id"] for e in visible],
    }
