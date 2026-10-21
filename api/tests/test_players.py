from api.simulator import build_match
from api.players import player_stats


def test_pass_metadata_is_synthetic_deterministic_and_in_bounds():
    match = build_match()
    assert match == build_match()
    passes = [e for e in match["events"] if e["kind"] == "pass"]
    assert passes
    for e in passes:
        assert 0 <= e["end_x"] <= 100 and 0 <= e["end_y"] <= 100
        assert 0 <= e["pass_distance_m"] <= 127
        assert 1 <= e["pass_difficulty"] <= 5
        assert type(e["pass_completed"]) is bool


def test_player_metrics_only_use_past_events_and_cite_sources():
    match = build_match()
    player = "J. Okoro"
    early = player_stats(match["events"], player, 0)
    late = player_stats(match["events"], player, 5400)
    assert early["events"] == 0
    assert late["events"] > 0
    source_ids = {e["id"] for e in match["events"] if e["player"] == player}
    assert set(late["evidence_ids"]) == source_ids
    assert late["passes_completed"] <= late["passes_attempted"]
    assert late["pass_accuracy_pct"] is None or 0 <= late["pass_accuracy_pct"] <= 100


def test_original_insight_evidence_stays_stable():
    from api.analytics import detect_insights
    insight = detect_insights(build_match()["events"])[0]
    assert len(insight["evidence_ids"]) == 9
    assert insight["metric"]["recent"] == 9
