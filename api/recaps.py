"""Replay-safe, independently reproducible half-time and full-time recaps.

These narratives are deterministic templates, not Microsoft Foundry outputs.
The facts and source IDs are generated solely from synthetic events available
at their respective match-clock cutoff.
"""
from __future__ import annotations

from api.analytics import detect_insights


STAGES = (("half_time", 45 * 60), ("full_time", 90 * 60))
AR_TEAM = {"north": "نورثبورت", "south": "ساوثبريدج"}


def _clock(second: int) -> str:
    return f"{second // 60:02d}:{second % 60:02d}"


def _side_stats(events: list[dict], team: str) -> dict:
    selected = [e for e in events if e["team"] == team]
    passes = [e for e in selected if e["kind"] == "pass"]
    return {
        "passes_attempted": len(passes),
        "passes_completed": sum(e.get("pass_completed") is True for e in passes),
        "shots": sum(e["kind"] in ("shot", "goal") for e in selected),
        "recoveries": sum(e["kind"] == "recovery" for e in selected),
        "goals": sum(e["kind"] == "goal" for e in selected),
    }


def _narratives(stage: str, score: dict, stats: dict, goal_events: list[dict],
                shift: dict | None) -> dict:
    home, away = score["north"], score["south"]
    score_en = f"NOR {home}–{away} SOU"
    score_ar = f"{AR_TEAM['north']} {home}–{away} {AR_TEAM['south']}"
    header_en = "Half-time" if stage == "half_time" else "Full-time"
    header_ar = "نهاية الشوط الأول" if stage == "half_time" else "نهاية المباراة"
    goals_en = (
        " Goals: " + "; ".join(
            f"{event['player']} ({_clock(event['second'])})"
            for event in goal_events
        ) + "."
    ) if goal_events else " No goals have been recorded."
    goals_ar = (
        " المسجلون: " + "؛ ".join(
            f"{event['player']} ({_clock(event['second'])})"
            for event in goal_events
        ) + "."
    ) if goal_events else " لم تُسجّل أهداف."
    shift_en = ""
    shift_ar = ""
    if shift is not None:
        old, new = shift["metric"]["previous"], shift["metric"]["recent"]
        shift_en = (
            f" Northport made {new} high recoveries in minutes 65–75 "
            f"versus {old} in minutes 55–65; this alone does not prove why."
        )
        shift_ar = (
            f" سجل نورثبورت {new} استردادات عالية للكرة بين الدقيقتين 65–75 "
            f"مقابل {old} بين 55–65؛ ولا تكشف الأرقام وحدها السبب."
        )
    analyst_en = (
        f"{header_en}: {score_en}. "
        f"Northport completed {stats['north']['passes_completed']} of "
        f"{stats['north']['passes_attempted']} passes and recorded "
        f"{stats['north']['shots']} shots including goals; Southbridge completed "
        f"{stats['south']['passes_completed']} of "
        f"{stats['south']['passes_attempted']} passes and recorded "
        f"{stats['south']['shots']} shots including goals."
        f"{shift_en}"
    )
    analyst_ar = (
        f"{header_ar}: {score_ar}. أكمل نورثبورت "
        f"{stats['north']['passes_completed']} من {stats['north']['passes_attempted']} "
        f"تمريرات وسجل {stats['north']['shots']} تسديدات شاملة الأهداف؛ "
        f"وأكمل ساوثبريدج {stats['south']['passes_completed']} من "
        f"{stats['south']['passes_attempted']} تمريرات وسجل "
        f"{stats['south']['shots']} تسديدات شاملة الأهداف."
        f"{shift_ar}"
    )
    return {
        "en": {
            "fan": f"{header_en}: {score_en}.{goals_en}{shift_en}",
            "analyst": analyst_en,
            "broadcast": f"{header_en.upper()} · {score_en}",
        },
        "ar": {
            "fan": f"{header_ar}: {score_ar}.{goals_ar}{shift_ar}",
            "analyst": analyst_ar,
            "broadcast": f"{header_ar} · {score_ar}",
        },
    }


def build_match_recaps(match: dict) -> list[dict]:
    """Return exactly two recap snapshots with verifiable, cutoff-safe claims."""
    all_events = match["events"]
    recaps = []
    for stage, at_second in STAGES:
        if at_second > match["duration_seconds"]:
            continue
        visible = [e for e in all_events if e["second"] <= at_second]
        goals = [e for e in visible if e["kind"] == "goal"]
        stats = {team: _side_stats(visible, team) for team in ("north", "south")}
        score = {team: stats[team]["goals"] for team in ("north", "south")}
        insights = [
            item for item in detect_insights(visible)
            if item["at_second"] <= at_second
        ]
        shift = insights[0] if insights else None
        cited = [event["id"] for event in goals]
        if shift:
            cited.extend(shift["evidence_ids"])
            cited.extend(shift["baseline_ids"])
        evidence_ids = list(dict.fromkeys(cited))
        known = {e["id"] for e in visible}
        assert set(evidence_ids) <= known, "Recap includes future evidence."
        recaps.append({
            "id": "RECAP-HT" if stage == "half_time" else "RECAP-FT",
            "stage": stage,
            "at_second": at_second,
            "source": "deterministic-synthetic-recap",
            "ai_generated": False,
            "score": score,
            "team_stats": stats,
            "goal_events": [
                {"id": e["id"], "second": e["second"],
                 "player": e["player"], "team": e["team"]}
                for e in goals
            ],
            "insight_ids": [item["id"] for item in insights],
            "evidence_ids": evidence_ids,
            "narratives": _narratives(stage, score, stats, goals, shift),
            "method": (
                "All counts recomputed from fictional events at or before "
                f"{_clock(at_second)}; passing completion comes from synthetic "
                "pass outcomes. No real tracking footage or AI inference."
            ),
        })
    return recaps
