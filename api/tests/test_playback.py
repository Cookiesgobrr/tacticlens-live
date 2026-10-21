from api.simulator import build_match
from api.movement import build_movement
from api.playback import build_playback
from api.export_static_demo import create_snapshot

def test_playback_is_synchronized_and_source_events_unchanged():
    match = build_match()
    original = [e.copy() for e in match["events"]]
    playback = build_playback(match, build_movement(match))
    assert match["events"] == original
    assert len(playback["ball_frames"]) == match["duration_seconds"] + 1
    assert len(playback["segments"]) == len(original)
    assert [s["source_event_id"] for s in playback["segments"]] == [e["id"] for e in original]

def test_ball_frames_have_valid_ground_height_owners_and_phases():
    match = build_match()
    movement = build_movement(match)
    playback = build_playback(match, movement)
    assert all(-51 <= x <= 51 and -33 <= z <= 33 and 0.42 <= h <= 4
               and -1 <= owner < len(movement["players"]) and phase in range(5)
               for x,z,h,owner,phase in playback["ball_frames"])
    assert any(frame[4] == 1 for frame in playback["ball_frames"])
    assert any(frame[4] == 2 for frame in playback["ball_frames"])
    assert any(frame[4] == 3 for frame in playback["ball_frames"])
    assert playback == build_playback(match, movement)
    assert create_snapshot()["playback"] == playback
