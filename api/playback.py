"""Coherent visual ball/possession continuity for the fictional demo.

This reconstruction uses player motion samples and original event ordering.
It is a PRESENTATION layer, not observed tracking. Passing receivers,
inter-event handoffs and restarts are explicitly inferred, never silently
added as measured match events.
"""
from __future__ import annotations

import math

from api.movement import pitch_metres


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _lerp(a: float, b: float, progress: float) -> float:
    return a + (b - a) * _clamp(progress, 0, 1)


def _actor(movement: dict, idx: int, time: float) -> tuple[float, float]:
    frames = movement["frames"]
    tick = _clamp(time / movement["sample_seconds"], 0, len(frames) - 1)
    first = int(tick)
    second = min(first + 1, len(frames) - 1)
    fraction = tick - first
    a, b = frames[first][idx], frames[second][idx]
    return _lerp(a[0], b[0], fraction), _lerp(a[1], b[1], fraction)


def _flight(begin: tuple[float, float], finish: tuple[float, float],
            progress: float, height: float) -> tuple[float, float, float]:
    fraction = _clamp(progress, 0, 1)
    return (_lerp(begin[0], finish[0], fraction),
            _lerp(begin[1], finish[1], fraction),
            0.42 + height * math.sin(math.pi * fraction))


def build_playback(match: dict, movement: dict) -> dict:
    """Build a 1 Hz synchronized 3D ball path, with explicit ownership phases.

    ball_frames[t] = [x_m, z_m, height_m, owner_index, phase_code]
    phase codes: 0 actor control, 1 pass, 2 shot, 3 inferred handoff,
    4 inferred post-shot restart. The player motion is already speed-capped.
    """
    events = sorted(match["events"], key=lambda e: (e["second"], e["id"]))
    players = movement["players"]
    player_ids = {p["id"]: idx for idx, p in enumerate(players)}
    frames = movement["frames"]
    duration = int(match["duration_seconds"])
    if not events:
        return {"ball_frames": [], "segments": [], "source": "synthetic-presentation",
                "phase_codes": {}}

    segments = []
    ball_frames = []
    cursor = -1
    first = events[0]
    first_actor_id = first["team"] + ":" + first["player"]
    first_idx = player_ids[first_actor_id]
    # Illustrative warm-up before the first recorded synthetic event:
    # a teammate controls the ball, makes one short visual handoff, then
    # the first source-event actor carries into their recorded moment.
    # The handoff is NOT appended to match["events"] or to match statistics.
    formation = movement["opening_formation"]
    supporter = player_ids[formation["supporter_id"]]
    first_idx = player_ids[formation["kicker_id"]]
    opening_start = formation["hold_seconds"]
    opening_end = min(first["second"] - 1, opening_start + 3)

    for t in range(duration + 1):
        while cursor + 1 < len(events) and events[cursor + 1]["second"] <= t:
            cursor += 1
        e = events[cursor] if cursor >= 0 else None
        nxt = events[cursor + 1] if cursor + 1 < len(events) else None
        if e is None:
            # Center-spot player takes the illustrative kickoff. The ball
            # travels to a supporting teammate and then back to the first
            # recorded event actor, without counting either as a source pass.
            return_start = max(opening_end + 1, first["second"] - 4)
            if opening_start <= t < opening_end and supporter != first_idx:
                bx, bz, height = _flight(
                    _actor(movement, first_idx, opening_start),
                    _actor(movement, supporter, opening_end),
                    (t - opening_start) / max(1, opening_end - opening_start), 0.5)
                owner_idx, phase = -1, 3
            elif return_start <= t < first["second"] and supporter != first_idx:
                bx, bz, height = _flight(
                    _actor(movement, supporter, return_start),
                    _actor(movement, first_idx, first["second"]),
                    (t - return_start) / max(1, first["second"] - return_start), 0.5)
                owner_idx, phase = -1, 3
            else:
                owner_idx = first_idx if t < opening_start else supporter
                bx, bz = _actor(movement, owner_idx, t)
                height, phase = 0.42, 0
            ball_frames.append([round(bx, 2), round(bz, 2),
                                round(height, 2), owner_idx, phase])
            continue

        actor_id = e["team"] + ":" + e["player"]
        owner_idx = player_ids[actor_id]
        next_idx = player_ids[nxt["team"] + ":" + nxt["player"]] if nxt else owner_idx
        elapsed = t - e["second"]
        original_end = nxt["second"] if nxt else duration + 1
        start = _actor(movement, owner_idx, e["second"])
        bx, bz = _actor(movement, owner_idx, t)
        height, phase = 0.42, 0
        current_owner = owner_idx
        special_time = 0.0
        special_end: tuple[float, float] = start
        special_phase = 0
        if e["kind"] == "pass":
            special_time = min(2.6, max(0, original_end - e["second"] - 1))
            predicted_target = pitch_metres(e.get("end_x", e["x"]), e.get("end_y", e["y"]))
            eligible = [
                (i, _actor(movement, i, e["second"] + special_time))
                for i, p in enumerate(players)
                if p["team"] == e["team"] and i != owner_idx
            ]
            if eligible:
                closest = min(eligible,
                              key=lambda pair: math.dist(pair[1], predicted_target))[0]
                receiver = (next_idx if nxt and nxt["team"] == e["team"]
                            and nxt["player"] != e["player"] and e.get("pass_completed")
                            else closest)
                # Incomplete pass is presented as a loose ball near the source
                # synthetic endpoint, not a confirmed receiver.
                special_end = (_actor(movement, receiver, e["second"] + special_time)
                               if e.get("pass_completed") else predicted_target)
                if elapsed >= special_time and e.get("pass_completed"):
                    current_owner = receiver
                    bx, bz = _actor(movement, receiver, t)
            else:
                special_end = predicted_target
            special_phase = 1
        elif e["kind"] in ("goal", "shot"):
            special_time = min(2.1, max(0, original_end - e["second"] - 1))
            special_end = (50.0 if e["team"] == "north" else -50.0,
                           _clamp((e["y"] - 50) * 0.15, -3.5, 3.5))
            special_phase = 2

        if 0 < special_time and elapsed < special_time:
            bx, bz, height = _flight(start, special_end, elapsed / special_time,
                                     2.7 if special_phase == 2 else 0.55)
            phase = special_phase
        elif special_phase == 2 and elapsed >= special_time:
            # Goal/shot clearance is inferred between source moments.
            bx, bz = special_end
            height, phase = 0.42, 4
        elif special_phase == 1 and not e.get("pass_completed") and elapsed >= special_time:
            bx, bz = special_end

        # A coherent, bounded-time visual handoff to the next source-event
        # player is preferred over the previously visible ball teleport.
        # When source events are spatially implausible we show an inferred
        # cinematic transition, never claim it was a recorded pass.
        if nxt and next_idx != current_owner and t >= e["second"] + special_time:
            remaining = nxt["second"] - t
            next_position = _actor(movement, next_idx, nxt["second"])
            handoff_origin = _actor(movement, current_owner, t)
            distance = math.dist(handoff_origin, next_position)
            # Begin handoff early enough for <= 18 m/s where possible.
            remaining_interval = max(1, nxt["second"] - e["second"] - special_time)
            handoff_length = min(remaining_interval, max(3.0, distance / 18.0 + 1.0))
            if remaining <= handoff_length:
                from_time = nxt["second"] - handoff_length
                origin = (_actor(movement, current_owner, from_time)
                          if special_phase != 2 else special_end)
                bx, bz, height = _flight(origin, next_position,
                                         (t - from_time) / handoff_length, 0.45)
                phase, current_owner = 3, -1
        if nxt and next_idx == current_owner and special_phase == 2:
            # Hold shot destination briefly, then return smoothly to owner.
            comeback_time = max(e["second"] + special_time,
                                nxt["second"] - max(3, (nxt["second"] - e["second"]) * 0.5))
            if t >= comeback_time:
                bx, bz, height = _flight(special_end, _actor(movement, next_idx, nxt["second"]),
                                         (t - comeback_time) / max(1, nxt["second"] - comeback_time), 0.45)
                phase = 4
        ball_frames.append([round(_clamp(bx, -51, 51), 2),
                            round(_clamp(bz, -33, 33), 2),
                            round(_clamp(height, 0.42, 4), 2),
                            current_owner, phase])

    for idx, event in enumerate(events):
        current = event["team"] + ":" + event["player"]
        following = events[idx + 1] if idx + 1 < len(events) else None
        segments.append({
            "source_event_id": event["id"],
            "second": event["second"],
            "kind": event["kind"],
            "actor_id": current,
            "next_source_id": following["id"] if following else None,
            "next_source_actor": following["team"] + ":" + following["player"]
                                 if following else None,
            "inferred_transfer": bool(following and following["player"] != event["player"]),
        })
    return {
        "schema_version": "1.0",
        "source": "deterministic-synthetic-visual-reconstruction",
        "measurement_status": "NOT OBSERVED TRACKING; HANDOFFS AND RECEIVERS INFERRED",
        "sample_seconds": 1,
        "phase_codes": {"control": 0, "pass_flight": 1, "shot_flight": 2,
                        "inferred_handoff": 3, "inferred_restart": 4},
        "ball_frames": ball_frames,
        "segments": segments,
        "opening_reconstruction": {
            "before_first_recorded_event": first["second"],
            "visual_handoff_start": opening_start,
            "visual_handoff_end": opening_end,
            "illustrative_return_start": max(opening_end + 1, first["second"] - 4),
            "from_player_id": formation["kicker_id"],
            "to_player_id": formation["supporter_id"],
            "disclaimer": "Illustrative pre-event opening; not a logged pass or statistic.",
        },
        "method": "Ball follows a simulated controlling player, moves through source-linked pass/shot phases and interpolates inferred changes of possession. The pre-event opening is explicitly illustrative; source match event facts remain unchanged.",
    }
