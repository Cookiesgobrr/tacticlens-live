from api.simulator import build_match
from api.recaps import build_match_recaps
from api.export_static_demo import create_snapshot


def test_recap_cutoffs_and_sources():
    match = build_match()
    half, full = build_match_recaps(match)
    assert (half["at_second"], full["at_second"]) == (2700, 5400)
    assert half["score"] == {"north": 0, "south": 1}
    assert full["score"] == {"north": 1, "south": 1}
    ids = {e["id"]: e for e in match["events"]}
    for recap in (half, full):
        assert all(ids[ref]["second"] <= recap["at_second"] for ref in recap["evidence_ids"])
        assert not recap["ai_generated"]
        assert {"en", "ar"} == set(recap["narratives"])
        assert all({"fan", "analyst", "broadcast"} == set(v) for v in recap["narratives"].values())
    assert "INS-001" not in half["insight_ids"]
    assert "INS-001" in full["insight_ids"]


def test_recap_snapshots_stable_and_exported():
    match = build_match()
    assert build_match_recaps(match) == build_match_recaps(match)
    assert create_snapshot()["recaps"] == build_match_recaps(match)
