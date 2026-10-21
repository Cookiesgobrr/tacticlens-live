"""Frame-synchronized, audit-friendly football broadcast overlay cues.

All times are match-clock seconds. All cues are derived from synthetic events,
not video inference or live Premier League data.
"""
from __future__ import annotations

from typing import Any

DEFAULT_GOAL_SECONDS = 13
DEFAULT_INSIGHT_SECONDS = 20


def build_overlay_cues(match: dict[str, Any], insights: list[dict] | None = None) -> list[dict]:
    """Generate deterministic broadcast overlays with explicit source events.

    These are safe-to-render cue contracts, not claims of external broadcast
    integration. Consumers use start_second <= match_clock < end_second.
    """
    from api.analytics import detect_insights

    events = match["events"]
    duration = match["duration_seconds"]
    allowed_ids = {event["id"] for event in events}
    insights = detect_insights(events) if insights is None else insights
    scores = {team["id"]: 0 for team in match["teams"]}
    cues: list[dict] = []

    for event in events:
        if event["kind"] != "goal":
            continue
        scores[event["team"]] += 1
        timestamp = int(event["second"])
        if timestamp >= duration:
            continue
        cues.append({
            "id": "OVL-" + event["id"],
            "schema_version": "1.0",
            "kind": "goal",
            "match_id": match["match_id"],
            "team": event["team"],
            "start_second": timestamp,
            "end_second": min(duration, timestamp + DEFAULT_GOAL_SECONDS),
            "priority": 100,
            "placement": "lower-third",
            "headline": "GOAL",
            "subtitle": f'{event["player"]} scores · NOR {scores["north"]}–{scores["south"]} SOU',
            "source_event_ids": [event["id"]],
            "data": {
                "scorer": event["player"],
                "score": dict(scores),
                "origin": "synthetic-event"
            },
        })

    for insight in insights:
        ids = insight.get("evidence_ids", []) + insight.get("baseline_ids", [])
        if not ids or not set(ids).issubset(allowed_ids):
            raise ValueError("Insight cites an unknown or missing synthetic event.")
        timestamp = int(insight["at_second"])
        if timestamp < 0 or timestamp >= duration:
            continue
        if any(next(event for event in events if event["id"] == ref)["second"] > timestamp
               for ref in ids):
            raise ValueError("Insight cites an event from the future.")
        metric = insight["metric"]
        cues.append({
            "id": "OVL-" + insight["id"],
            "schema_version": "1.0",
            "kind": "insight",
            "match_id": match["match_id"],
            "team": insight["team"],
            "start_second": timestamp,
            "end_second": min(duration, timestamp + DEFAULT_INSIGHT_SECONDS),
            "priority": 60,
            "placement": "lower-third",
            "headline": insight["broadcast"],
            "subtitle": (
                f'{metric["previous"]} → {metric["recent"]} '
                f'high recoveries across consecutive 10-minute windows'
            ),
            "source_event_ids": list(ids),
            "data": {
                "insight_id": insight["id"],
                "metric": dict(metric),
                "origin": "deterministic-analytics"
            },
        })

    cues.sort(key=lambda cue: (cue["start_second"], -cue["priority"], cue["id"]))
    return cues


def cues_at(cues: list[dict], match_second: int) -> list[dict]:
    """Cues relevant to the supplied match clock; top-priority first."""
    return sorted(
        [cue for cue in cues
         if cue["start_second"] <= match_second < cue["end_second"]],
        key=lambda cue: (-cue["priority"], cue["start_second"], cue["id"]),
    )
