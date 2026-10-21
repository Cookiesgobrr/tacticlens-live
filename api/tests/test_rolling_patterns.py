from api.rolling_patterns import detect_rolling_patterns
from api.simulator import build_match
from api.export_static_demo import create_snapshot


def test_detects_multiple_event_driven_pattern_types():
    events = build_match()["events"]
    patterns = detect_rolling_patterns(events)
    assert patterns, "Expected multiple patterns from the synthetic event stream"
    assert len({p["at_second"] for p in patterns}) >= 2
    assert len({p["type"] for p in patterns}) >= 2
    assert patterns == detect_rolling_patterns(events)


def test_no_future_leaks_evidence_and_cooldown():
    events = build_match()["events"]
    patterns = detect_rolling_patterns(events)
    by_id = {event["id"]: event for event in events}
    last = {}
    for p in patterns:
        assert p["at_second"] in {e["second"] for e in events}
        assert p["metric"]["recent"] == len(p["evidence_ids"])
        assert p["metric"]["previous"] == len(p["baseline_ids"])
        assert set(p["evidence_ids"] + p["baseline_ids"]) <= set(by_id)
        assert all(by_id[id]["second"] <= p["at_second"] for id in p["evidence_ids"] + p["baseline_ids"])
        key = (p["team"], p["type"])
        assert key not in last or p["at_second"] - last[key] >= 480
        last[key] = p["at_second"]


def test_replay_truncation_never_uses_future_data():
    events = build_match()["events"]
    for at in (900, 1800, 2400, 3300, 4500):
        visible = [e for e in events if e["second"] <= at]
        assert all(p["at_second"] <= at for p in detect_rolling_patterns(visible, at))


def test_public_snapshot_includes_patterns():
    assert create_snapshot()["rolling_patterns"] == detect_rolling_patterns(build_match()["events"])
