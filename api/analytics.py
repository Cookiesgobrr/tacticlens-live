"""Deterministic football analytics and auditable insight generation."""
from __future__ import annotations


SHOT_KINDS = {"shot", "goal"}
HIGH_RECOVERY_X = 67.0


def match_stats(events: list[dict], at_second: int) -> dict:
    """Stats up to (and including) the replay timestamp.

    'Control share' uses synthetic control_seconds, not true video tracking.
    """
    visible = [event for event in events if event["second"] <= at_second]
    stats = {
        team: {"passes": 0, "shots": 0, "goals": 0, "recoveries": 0,
               "control_seconds": 0, "pressures": 0}
        for team in ("north", "south")
    }
    for event in visible:
        row = stats[event["team"]]
        kind = event["kind"]
        if kind == "pass":
            row["passes"] += 1
        if kind in SHOT_KINDS:
            row["shots"] += 1
        if kind == "goal":
            row["goals"] += 1
        if kind == "recovery":
            row["recoveries"] += 1
        if kind == "pressure":
            row["pressures"] += 1
        row["control_seconds"] += event["control_seconds"]

    total = sum(row["control_seconds"] for row in stats.values())
    for row in stats.values():
        row["control_share_pct"] = round(
            row["control_seconds"] / total * 100
        ) if total else 50
    return stats


def _recoveries(events: list[dict], team: str, start: int, end: int) -> list[dict]:
    return [
        event for event in events
        if event["team"] == team
        and event["kind"] == "recovery"
        and event["x"] >= HIGH_RECOVERY_X
        and start <= event["second"] < end
    ]


def detect_insights(events: list[dict]) -> list[dict]:
    """Conservative window comparison; each claim cites its contributing IDs."""
    window = 10 * 60
    at_second = 75 * 60
    prev = _recoveries(events, "north", at_second - 2 * window,
                       at_second - window)
    recent = _recoveries(events, "north", at_second - window, at_second)
    change = len(recent) - len(prev)
    if len(recent) < 4 or change < 3:
        return []

    return [{
        "id": "INS-001",
        "at_second": at_second,
        "team": "north",
        "type": "high_recovery_shift",
        "headline": "Northport's high recoveries have accelerated",
        "casual": (
            f"Northport won the ball high up the pitch {len(recent)} times "
            f"in the last 10 minutes, versus {len(prev)} in the 10 before."
        ),
        "analyst": (
            f"High recoveries (x >= {HIGH_RECOVERY_X:.0f}/100): "
            f"{len(prev)} from minutes 55–65 vs {len(recent)} from 65–75 "
            f"(+{change}). This indicates a change in where the ball is won; "
            "it does not alone prove a specific tactical cause."
        ),
        "broadcast": f"NORTHPORT: {len(recent)} HIGH RECOVERIES IN 10 MIN",
        "metric": {
            "name": "High recoveries",
            "previous": len(prev),
            "recent": len(recent),
            "delta": change,
            "previous_window": "55:00–65:00",
            "recent_window": "65:00–75:00",
        },
        "evidence_ids": [event["id"] for event in recent],
        "baseline_ids": [event["id"] for event in prev],
        "method": (
            "Count north recovery events with x >= 67 in each 10-minute "
            "window; compare [55:00,65:00) with [65:00,75:00). "
            "All locations and events are synthetic."
        ),
    }]
