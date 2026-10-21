from api.simulator import build_match
from api.movement import build_movement
from api.export_static_demo import create_snapshot
import math

def test_every_player_moves_concurrently_and_speed_is_limited():
    movement = build_movement(build_match())
    assert len(movement["players"]) == 12
    assert len(movement["frames"]) == 5401
    for frame in movement["frames"]:
        assert len(frame) == 12
    for previous, current in zip(movement["frames"], movement["frames"][1:]):
        moving = sum(math.hypot(a[0] - b[0], a[1] - b[1]) > 0.25 for a,b in zip(previous, current))
        assert moving <= 12
        for i,(a,b) in enumerate(zip(previous,current)):
            displacement = math.hypot(a[0]-b[0], a[1]-b[1])
            assert displacement <= movement["players"][i]["max_speed_mps"] + 0.04
            assert b[2] <= movement["players"][i]["max_speed_mps"] + 0.04
    assert max(sum(frame[i][2] > 3 for i in range(12)) for frame in movement["frames"]) >= 6

def test_logs_deterministic_and_event_alignment_recorded():
    match = build_match()
    first = build_movement(match)
    assert first == build_movement(match)
    assert set(first["event_alignment"]) == {e["id"] for e in match["events"]}
    assert all(value["estimated_position_error_m"] >= 0 for value in first["event_alignment"].values())
    assert all(row["distance_m"] > 0 for row in first["summary"])
    assert create_snapshot()["movement"] == first
