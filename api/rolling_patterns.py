"""Rolling, evidence-backed football patterns discovered as events arrive.

This detector is deterministic, not generative AI. Each surfaced pattern
uses only events with second <= its timestamp and includes all contributing
source IDs. Adjacent alerts of the same type/team have a cooldown.
"""
from __future__ import annotations

from collections import defaultdict

WINDOW = 5 * 60
COOLDOWN = 8 * 60
THRESHOLDS = {
    "shot": (2, 2),
    "pressure": (3, 2),
    "high_recovery": (2, 2),
    "completed_pass": (6, 5),
}
TITLES = {
    "shot": "Shot volume is rising",
    "pressure": "Pressure events are increasing",
    "high_recovery": "High ball recoveries are climbing",
    "completed_pass": "Completed passing is accelerating",
}
NOUNS = {
    "shot": "shots",
    "pressure": "pressure events",
    "high_recovery": "high recoveries",
    "completed_pass": "completed passes",
}


def _qualifies(event: dict, pattern: str) -> bool:
    kind = event["kind"]
    if pattern == "shot":
        return kind in ("shot", "goal")
    if pattern == "pressure":
        return kind == "pressure"
    if pattern == "high_recovery":
        return kind == "recovery" and event["x"] >= 67
    if pattern == "completed_pass":
        return kind == "pass" and event.get("pass_completed") is True
    return False


def detect_rolling_patterns(events: list[dict], duration: int = 5400) -> list[dict]:
    """Check the match on each event timestamp, not on preset minute marks."""
    ordered = sorted((e for e in events if 0 <= e["second"] <= duration),
                     key=lambda e: (e["second"], e["id"]))
    teams = {"north": "Northport", "south": "Southbridge"}
    last_trigger: dict[tuple[str, str], int] = defaultdict(lambda: -COOLDOWN)
    output = []
    for trigger in ordered:
        current = trigger["second"]
        if current < WINDOW * 2:
            continue
        team = trigger["team"]
        for pattern, (minimum, increase) in THRESHOLDS.items():
            if not _qualifies(trigger, pattern):
                continue
            key = (team, pattern)
            if current - last_trigger[key] < COOLDOWN:
                continue
            previous = [e for e in ordered if e["team"] == team
                        and current - 2 * WINDOW <= e["second"] < current - WINDOW
                        and _qualifies(e, pattern)]
            recent = [e for e in ordered if e["team"] == team
                      and current - WINDOW <= e["second"] <= current
                      and _qualifies(e, pattern)]
            if len(recent) < minimum or len(recent) - len(previous) < increase:
                continue
            if not recent or recent[-1]["id"] != trigger["id"]:
                continue
            last_trigger[key] = current
            old, new = len(previous), len(recent)
            label = NOUNS[pattern]
            output.append({
                "id": f"PAT-{len(output)+1:03d}",
                "at_second": current,
                "team": team,
                "type": pattern,
                "headline": f"{teams[team]}: {TITLES[pattern].lower()}",
                "casual": f"{teams[team]} recorded {new} {label} in the latest five-minute window, versus {old} in the preceding five.",
                "analyst": f"{teams[team]} {label}: {old} in [{current-600},{current-300}) seconds versus {new} in [{current-300},{current}] seconds. The change does not establish its tactical cause.",
                "broadcast": f"{teams[team].upper()}: {new} {label.upper()} IN 5 MIN",
                "metric": {
                    "name": label,
                    "previous": old,
                    "recent": new,
                    "delta": new - old,
                    "previous_window": f"{current-600}-{current-300}s",
                    "recent_window": f"{current-300}-{current}s",
                },
                "evidence_ids": [e["id"] for e in recent],
                "baseline_ids": [e["id"] for e in previous],
                "method": f"Sliding five-minute event count for {pattern}; all source events fictional. Pattern is rule-based, not Microsoft Foundry output.",
            })
    return output
