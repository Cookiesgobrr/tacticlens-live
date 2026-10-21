"""Reproducible synthetic 12-player movement tracks and audit metadata.

Movement is *procedural reconstruction*, not player tracking or a measurement
from any football video. Original audited synthetic match events never change.
The 1 Hz track enforces explicit maximum speed and acceleration constraints.
"""
from __future__ import annotations

import math
from collections import defaultdict

from api.simulator import PLAYERS

SAMPLE_SECONDS = 1
ACCELERATION_CAP_MPS2 = 3.6
RUN_THRESHOLD_MPS = 3.0
FIELD_X_M = 105.0
FIELD_Z_M = 68.0


def pitch_metres(x: float, y: float) -> tuple[float, float]:
    """Convert source event positions on a 0-100 pitch into centered metres."""
    return (x - 50) * FIELD_X_M / 100, (y - 50) * FIELD_Z_M / 100


def _limit(x: float, low: float, high: float) -> float:
    return min(high, max(low, x))


def _magnitude(x: float, z: float) -> float:
    return math.hypot(x, z)


def _actor_target(
    t: int, team: str, index: int, ball: tuple[float, float],
    next_event: dict | None,
) -> tuple[float, float]:
    """Blend team positioning and coordinated runs with future event anchors.

    Event anchors guide reconstruction; this does *not* predict future play.
    """
    base_x = ([-32, -21, -10, 2, 14, 22][index]
              if team == "north" else [32, 21, 10, -2, -14, -22][index])
    base_z = [-23, -10, 3, 17, 25, -19][index]
    bx, bz = ball
    # Each actor responds to ball position but has a staggered role and
    # independent directional running phase, so many move simultaneously.
    target_x = 0.59 * base_x + 0.41 * (bx + (index - 2.5) * 2.8)
    target_z = 0.57 * base_z + 0.43 * bz
    phase = (index + (0 if team == "north" else 6)) * 1.31
    target_x += 12.0 * math.sin(t * 0.18 + phase)
    target_z += 10.0 * math.cos(t * 0.16 + phase * 1.3)

    # Player event locations are real within *this fictional data stream*.
    # Pull a player toward their own next event without ever teleporting.
    if next_event is not None:
        remaining = next_event["second"] - t
        if 0 <= remaining <= 26:
            ex, ez = pitch_metres(next_event["x"], next_event["y"])
            influence = min(1.0, (26 - remaining) / 14)
            target_x = (1 - influence) * target_x + influence * ex
            target_z = (1 - influence) * target_z + influence * ez

    return _limit(target_x, -50, 50), _limit(target_z, -32, 32)


def build_movement(match: dict) -> dict:
    """Build 1 Hz simultaneous movement frames and source-linked summaries.

    frames[second][player_index] = [x_metres, z_metres, speed_metres_per_second]
    Source event coordinates and tracking estimates are never conflated.
    """
    events = sorted(match["events"], key=lambda e: (e["second"], e["id"]))
    duration = int(match["duration_seconds"])
    players = [
        {"id": team + ":" + name, "team": team, "name": name,
         "max_speed_mps": round(7.3 + (ix % 4) * 0.42, 2)}
        for team in ("north", "south")
        for ix, name in enumerate(PLAYERS[team])
    ]
    tracks: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for event in events:
        tracks[(event["team"], event["player"])].append(event)
    event_positions = {}
    states = []
    for actor in players:
        own = tracks[(actor["team"], actor["name"])]
        index = PLAYERS[actor["team"]].index(actor["name"])
        ball_init = pitch_metres(events[0]["x"], events[0]["y"]) if events else (0, 0)
        x, z = _actor_target(0, actor["team"], index, ball_init, own[0] if own else None)
        if own and own[0]["second"] <= 30:
            ex, ez = pitch_metres(own[0]["x"], own[0]["y"])
            x, z = ex, ez
        states.append({"x": x, "z": z, "vx": 0.0, "vz": 0.0,
                       "distance": 0.0, "peak": 0.0, "running": 0,
                       "event_index": 0})
    first_frame = [[round(s["x"], 2), round(s["z"], 2), 0.0] for s in states]
    frames = [first_frame]
    event_cursor = 0
    active_ball = pitch_metres(events[0]["x"], events[0]["y"]) if events else (0.0, 0.0)

    for t in range(1, duration + 1):
        while event_cursor < len(events) and events[event_cursor]["second"] <= t:
            active_ball = pitch_metres(events[event_cursor]["x"], events[event_cursor]["y"])
            event_cursor += 1

        frame = []
        for index, actor in enumerate(players):
            state = states[index]
            own = tracks[(actor["team"], actor["name"])]
            while (state["event_index"] < len(own)
                   and own[state["event_index"]]["second"] < t):
                state["event_index"] += 1
            future = own[state["event_index"]] if state["event_index"] < len(own) else None
            team_index = PLAYERS[actor["team"]].index(actor["name"])
            tx, tz = _actor_target(t, actor["team"], team_index, active_ball, future)
            dx, dz = tx - state["x"], tz - state["z"]
            distance = _magnitude(dx, dz)
            cap = actor["max_speed_mps"]
            speed_target = min(cap, distance * 0.88)
            wanted_x = dx / distance * speed_target if distance > 1e-8 else 0
            wanted_z = dz / distance * speed_target if distance > 1e-8 else 0
            accel_x = wanted_x - state["vx"]
            accel_z = wanted_z - state["vz"]
            accel = _magnitude(accel_x, accel_z)
            if accel > ACCELERATION_CAP_MPS2:
                fraction = ACCELERATION_CAP_MPS2 / accel
                accel_x *= fraction
                accel_z *= fraction
            vx, vz = state["vx"] + accel_x, state["vz"] + accel_z
            vel_magnitude = _magnitude(vx, vz)
            if vel_magnitude > cap:
                vx *= cap / vel_magnitude
                vz *= cap / vel_magnitude
            nx = _limit(state["x"] + vx, -51.0, 51.0)
            nz = _limit(state["z"] + vz, -33.0, 33.0)
            # Boundary collision reduces movement; never reports fictitious
            # travel beyond the physical edge of the pitch.
            vx, vz = nx - state["x"], nz - state["z"]
            actual_speed = _magnitude(vx, vz)
            state["x"], state["z"] = nx, nz
            state["vx"], state["vz"] = vx, vz
            state["distance"] += actual_speed
            state["peak"] = max(state["peak"], actual_speed)
            if actual_speed >= RUN_THRESHOLD_MPS:
                state["running"] += SAMPLE_SECONDS
            frame.append([round(nx, 2), round(nz, 2), round(actual_speed, 2)])
        frames.append(frame)

    summary = []
    for idx, actor in enumerate(players):
        state = states[idx]
        summary.append({
            "player_id": actor["id"],
            "name": actor["name"],
            "team": actor["team"],
            "distance_m": round(state["distance"], 1),
            "peak_speed_mps": round(state["peak"], 2),
            "running_seconds": state["running"],
        })

    for event in events:
        second = min(duration, max(0, int(event["second"])))
        actor_id = event["team"] + ":" + event["player"]
        actor_idx = next(i for i, actor in enumerate(players) if actor["id"] == actor_id)
        measured_x, measured_z = frames[second][actor_idx][:2]
        ex, ez = pitch_metres(event["x"], event["y"])
        event_positions[event["id"]] = {
            "second": second,
            "player_id": actor_id,
            "kind": event["kind"],
            "estimated_position_error_m": round(_magnitude(ex - measured_x, ez - measured_z), 2),
        }

    return {
        "schema_version": "1.0",
        "match_id": match["match_id"],
        "source": "deterministic-synthetic-movement",
        "measurement_status": "SIMULATED — NOT PLAYER TRACKING OR VIDEO DERIVED",
        "sample_seconds": SAMPLE_SECONDS,
        "acceleration_cap_mps2": ACCELERATION_CAP_MPS2,
        "pitch_size_m": [FIELD_X_M, FIELD_Z_M],
        "players": players,
        "frames": frames,
        "summary": summary,
        "event_alignment": event_positions,
        "method": "1 Hz concurrent movement with capped velocity and acceleration, tactical targets and event anchors. Distances/speeds derived from simulated positions. Sparse source events are separate and may not align exactly.",
    }
