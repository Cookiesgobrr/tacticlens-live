from api.analytics import detect_insights, match_stats
from api.simulator import DURATION_SECONDS, build_match


def test_repeatable_same_seed():
    assert build_match() == build_match()


def test_events_sorted_with_unique_ids():
    events = build_match()["events"]
    assert [e["second"] for e in events] == sorted(e["second"] for e in events)
    assert len({e["id"] for e in events}) == len(events)
    assert all(0 <= e["second"] <= DURATION_SECONDS for e in events)


def test_score_and_shots():
    events = build_match()["events"]
    stats = match_stats(events, DURATION_SECONDS)
    assert stats["north"]["goals"] == 1
    assert stats["south"]["goals"] == 1
    assert stats["north"]["shots"] >= stats["north"]["goals"]
    assert stats["south"]["shots"] >= stats["south"]["goals"]


def test_control_share_is_estimate_and_sums_to_100():
    stats = match_stats(build_match()["events"], DURATION_SECONDS)
    # Independent integer rounding may produce 99-101.
    total = sum(v["control_share_pct"] for v in stats.values())
    assert 99 <= total <= 101


def test_insight_has_traceable_evidence_and_correct_counts():
    events = build_match()["events"]
    insights = detect_insights(events)
    assert len(insights) == 1, "The intended 65-75 minute scenario must trigger"
    insight = insights[0]
    event_lookup = {e["id"]: e for e in events}
    assert insight["metric"]["recent"] == len(insight["evidence_ids"])
    assert insight["metric"]["previous"] == len(insight["baseline_ids"])
    assert all(eid in event_lookup for eid in insight["evidence_ids"])
    assert all(
        65 * 60 <= event_lookup[eid]["second"] < 75 * 60
        for eid in insight["evidence_ids"]
    )


def test_insight_suppressed_when_evidence_removed():
    events = [
        e for e in build_match()["events"]
        if not (e["team"] == "north" and e["kind"] == "recovery"
                and 65 * 60 <= e["second"] < 75 * 60)
    ]
    assert detect_insights(events) == []
