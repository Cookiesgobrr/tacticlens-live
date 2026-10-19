import json

from api.export_static_demo import create_snapshot, export_snapshot
from api.simulator import build_match
from api.analytics import detect_insights


def test_static_snapshot_matches_backend():
    snapshot = create_snapshot()
    generated = build_match()
    assert snapshot["events"] == generated["events"]
    assert snapshot["insights"] == detect_insights(generated["events"])
    assert snapshot["duration_seconds"] == 5400
    assert len(snapshot["insights"]) >= 1


def test_snapshot_export_writes_browser_friendly_json(tmp_path):
    path = export_snapshot(tmp_path / "demo-match.json")
    contents = json.loads(path.read_text(encoding="utf-8"))
    assert contents == create_snapshot()
    assert path.name == "demo-match.json"
