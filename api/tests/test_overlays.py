import pytest

from api.simulator import build_match
from api.analytics import detect_insights
from api.overlays import build_overlay_cues, cues_at
from api.export_static_demo import create_snapshot


def test_overlay_contract_and_replay_times():
    match = build_match()
    cues = build_overlay_cues(match)
    assert len(cues) >= 3
    all_ids = {event["id"] for event in match["events"]}
    assert any(cue["kind"] == "insight" for cue in cues)
    assert len([cue for cue in cues if cue["kind"] == "goal"]) == 2
    for cue in cues:
        assert 0 <= cue["start_second"] < cue["end_second"] <= 5400
        assert set(cue["source_event_ids"]) <= all_ids
        assert cue["schema_version"] == "1.0"
        assert cue["placement"] == "lower-third"


def test_cues_only_visible_within_match_clock_window():
    cues = build_overlay_cues(build_match())
    assert cues_at(cues, 0) == []
    assert any(cue["kind"] == "insight" for cue in cues_at(cues, 4500))
    assert all(cue["kind"] != "insight" for cue in cues_at(cues, 4520))


def test_rejects_fabricated_insight_sources():
    match = build_match()
    insight = dict(detect_insights(match["events"])[0])
    insight["evidence_ids"] = ["EVT-NONEXISTENT"]
    with pytest.raises(ValueError, match="unknown"):
        build_overlay_cues(match, [insight])


def test_static_snapshot_embeds_same_overlays_as_backend():
    snapshot = create_snapshot()
    match = build_match()
    assert snapshot["overlays"] == build_overlay_cues(match)
