from api.simulator import build_match
from api.formations import opening_formation
from api.movement import build_movement
from api.playback import build_playback
from api.export_static_demo import create_snapshot
import math


def test_kickoff_formation_has_six_per_side_and_legal_spacing():
    match = build_match()
    setup = opening_formation(match)
    positions = setup["positions_m"]
    assert len(positions) == 12
    assert setup["players_per_side"] == 6
    assert len({(p["x"], p["z"]) for p in positions.values()}) == 12
    assert positions[setup["kicker_id"]]["x"] == 0
    assert positions[setup["kicker_id"]]["z"] == 0
    for identifier, pos in positions.items():
        team = identifier.split(":")[0]
        assert -50 <= pos["x"] <= 50 and -32 <= pos["z"] <= 32
        if identifier == setup["kicker_id"]:
            continue
        assert pos["x"] <= 0 if team == "north" else pos["x"] >= 0
        if team != setup["kickoff_team"]:
            assert math.hypot(pos["x"], pos["z"]) >= 9.15


def test_kickoff_frames_and_ball_start_at_center_spot():
    match = build_match()
    original = [e.copy() for e in match["events"]]
    movement = build_movement(match)
    setup = movement["opening_formation"]
    for i, player in enumerate(movement["players"]):
        anchor = setup["positions_m"][player["id"]]
        assert movement["frames"][0][i][:2] == [anchor["x"], anchor["z"]]
        for t in range(setup["hold_seconds"] + 1):
            assert movement["frames"][t][i][:2] == [anchor["x"], anchor["z"]]
    playback = build_playback(match, movement)
    assert playback["ball_frames"][0][:3] == [0.0, 0.0, 0.42]
    assert playback["ball_frames"][0][3] == next(
        i for i,p in enumerate(movement["players"]) if p["id"] == setup["kicker_id"])
    assert match["events"] == original
    assert create_snapshot()["movement"]["opening_formation"] == setup
