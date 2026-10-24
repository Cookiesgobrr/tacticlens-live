"""Prefix-only dynamic events. No model, browser facts, or legacy cache mutation."""
from __future__ import annotations

import hashlib
import json
import math

SCHEMA = "tacticlens.session-source.v1"
KINDS = {"goal", "chance", "save", "defence", "sequence", "activity", "player", "halftime", "fulltime"}
AUDIENCES = ("fan", "analyst", "club_home", "club_away", "player", "broadcast")
CLAIMS = ("event", "score", "totals", "chance", "sequence", "activity", "player", "team0", "team1")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def validate_source(source):
    """Validate private operator-exported source; the approval separately pins its hash.

    A hash alone is not source authentication: the operator must regenerate using
    export-session-source.mjs at the approved engine commit before approving it.
    """
    seed = source.get("seed")
    version = source.get("engineVersion")
    mid = f"SIM-{seed}" + ("-F2" if version == "formations-v2" else "")
    if (source.get("schemaVersion") != SCHEMA or type(seed) is not int or not 1 <= seed <= 4294967295
            or version not in ("classic-v1", "formations-v2") or seed == 82 and version != "classic-v1"
            or source.get("matchId") != mid or source.get("duration") != 5400
            or not isinstance(source.get("engineSha256"), str) or len(source["engineSha256"]) != 64):
        raise ValueError("Invalid session source identity")
    players = source["players"]
    if (len(players) != 22 or [p["id"] for p in players] != list(range(22))
            or any(p["team"] != p["id"] // 11 for p in players)):
        raise ValueError("Invalid source players")
    seen, resolved, last = {}, set(), -1
    for i, e in enumerate(source["events"]):
        if (e["id"] != f"{mid}-{i+1:05d}" or type(e["time"]) not in (int, float)
                or not math.isfinite(e["time"]) or not last <= e["time"] <= 5400
                or type(e["player"]) is not int or not 0 <= e["player"] < 22
                or e["team"] != players[e["player"]]["team"]
                or any(not math.isfinite(e[k]) or not 0 <= e[k] <= b for k, b in (("x", 105), ("y", 68)))):
            raise ValueError("Invalid source event")
        last = e["time"]
        if e["type"] == "shot":
            dx = (105 if e["team"] == 0 else 0) - e["x"]
            distance = math.hypot(dx, 34 - e["y"])
            angle = math.atan2(abs(e["y"] - 34), max(1, abs(dx)))
            xg = max(.005, min(.55, .39 * math.exp(-max(0, distance-6)/12)
                     * max(.08, min(1, math.cos(angle)**2)) * max(.5, min(1, .5+e["shotPressure"]*.1))))
            if (abs(e["shotXg"]-xg) > 1e-9 or abs(e["shotDistance"]-distance) > 1e-7
                    or abs(e["shotAngle"]-angle*180/math.pi) > 1e-7):
                raise ValueError("Invalid shot geometry")
        if e.get("sourceId"):
            action = seen.get(e["sourceId"])
            shot_outcome = e["type"] in ("goal", "save", "miss")
            if (not action or action["id"] in resolved or action["time"] >= e["time"]
                    or action["type"] != ("shot" if shot_outcome else "pass")
                    or e["type"] == "goal" and (action["team"], action["player"]) != (e["team"], e["player"])):
                raise ValueError("Invalid action lineage")
            resolved.add(action["id"])
        elif e["type"] in ("goal", "save", "miss", "receive", "loose"):
            raise ValueError("Missing source action")
        seen[e["id"]] = e


def sequence(events, team, at, seconds=25):
    rows = []
    for e in reversed(events):
        if e["time"] > at:
            continue
        if e["time"] < at-seconds:
            break
        if e["type"] in ("pass", "receive", "tackle", "interception", "recovery", "save") and e["team"] != team:
            break
        if e["team"] == team and e["type"] in ("pass", "receive"):
            rows.insert(0, e)
    return rows


def detect(source, until):
    """Same source + same prefix => same eligible IDs, scores and cooldowns.

    Shot triggers wait for their actual outcome so a goal doesn't also spend a
    chance workflow. Routine passes, territorial guesses and unmeasured tactics
    are never AI triggers. Halftime/fulltime are legitimate lifecycle events.
    """
    if not math.isfinite(until) or not 0 <= until <= 5400:
        raise ValueError("Invalid server clock")
    events = [e for e in source["events"] if e["time"] <= until]
    seen, last, result = {}, {}, []
    for i, e in enumerate(events):
        kind, priority = None, 0
        action = seen.get(e.get("sourceId"))
        if e["type"] == "goal":
            kind, priority = "goal", 100
        elif e["type"] in ("save", "miss") and action and action.get("shotXg", 0) >= .10:
            kind = "save" if e["type"] == "save" else "chance"
            priority = 70 + min(15, int(action["shotXg"] * 100))
        elif e["type"] in ("interception", "tackle") and (e["x"] < 30 if e["team"] == 0 else e["x"] > 75):
            kind, priority = "defence", 65
        elif e["type"] == "receive" and sum(x["type"] == "receive" for x in sequence(events[:i+1], e["team"], e["time"])) >= 5:
            kind, priority = "sequence", 45
        if kind is None and e["type"] == "shot":
            recent = [x for x in events[:i+1] if e["time"]-300 < x["time"] and x["type"] == "shot" and x["team"] == e["team"]]
            previous = [x for x in events[:i+1] if e["time"]-600 < x["time"] <= e["time"]-300 and x["type"] == "shot" and x["team"] == e["team"]]
            if len(recent) >= 3 and len(recent)-len(previous) >= 2:
                kind, priority = "activity", 55
        if kind is None and e["type"] in ("shot", "tackle", "interception"):
            own = [x for x in events[:i+1] if x["player"] == e["player"] and x["type"] == e["type"]]
            if len(own) == (4 if e["type"] == "shot" else 3):
                kind, priority = "player", 50
        seen[e["id"]] = e
        if kind:
            cooldown = 0 if kind == "goal" else 180 if kind in ("save", "chance", "defence") else 600
            key = kind + (str(e["player"]) if kind == "player" else "")
            if e["time"] - last.get(key, -10000) < cooldown:
                continue
            last[key] = e["time"]
            result.append(dict(id=e["id"], atSecond=e["time"], kind=kind, priority=priority,
                               eventId=e["id"], player=e["player"], team=e["team"]))
    for at, kind in ((2700, "halftime"), (5400, "fulltime")):
        if at <= until:
            result.append(dict(id=f"{source['matchId']}:{kind}", atSecond=at, kind=kind, priority=95,
                               eventId=None, player=None, team=None))
    return sorted(result, key=lambda c: (c["atSecond"], c["id"]))


def facts_for(source, candidate):
    at = candidate["atSecond"]
    events = [e for e in source["events"] if e["time"] <= at]
    by_id = {e["id"]: e for e in events}
    event = by_id.get(candidate["eventId"])
    shot = by_id.get(event.get("sourceId")) if event else None
    if shot and shot["type"] != "shot":
        shot = None
    player, team = candidate["player"], candidate["team"]
    pair = lambda rows, kind: [sum(e["team"] == t and e["type"] == kind for e in rows) for t in (0, 1)]
    shots = [e for e in events if e["type"] == "shot"]
    recent = [e for e in events if at-300 < e["time"]]
    previous = [e for e in events if at-600 < e["time"] <= at-300]
    chain = sequence(events, team, shot["time"] if shot else at) if team is not None else []
    stats = dict(score=pair(events, "goal"), shots=pair(events, "shot"),
                 xg=[round(sum(e["shotXg"] for e in shots if e["team"] == t), 3) for t in (0, 1)],
                 passes=pair(events, "receive"), recentShots=pair(recent, "shot"), previousShots=pair(previous, "shot"),
                 completedSequence=sum(e["type"] == "receive" for e in chain),
                 playerGoals=sum(e["type"] == "goal" and e["player"] == player for e in events),
                 playerShots=sum(e["type"] == "shot" and e["player"] == player for e in events),
                 playerWins=sum(e["type"] in ("tackle", "interception", "recovery") and e["player"] == player for e in events))
    ids = lambda rows: list(dict.fromkeys(e["id"] for e in rows))
    claims = dict(event=ids([x for x in (shot, event) if x]), score=ids([e for e in events if e["type"] == "goal"]),
                  totals=ids(shots), activity=ids([e for e in previous+recent if e["type"] == "shot"]),
                  team0=ids([e for e in events if e["team"] == 0 and e["type"] in ("shot", "goal")]),
                  team1=ids([e for e in events if e["team"] == 1 and e["type"] in ("shot", "goal")]))
    if player is not None:
        claims["player"] = ids([e for e in events if e["player"] == player and e["type"] in ("shot", "goal", "tackle", "interception", "recovery")])
        claims["sequence"] = ids(chain)
    if shot:
        claims["chance"] = [shot["id"]]
    # Text from event logs is deliberately excluded from the model payload.
    return dict(matchId=source["matchId"], seed=source["seed"], engineVersion=source["engineVersion"],
                candidate=candidate, stats=stats, claims=claims,
                actor=source["players"][player] if player is not None else None,
                shot={k: shot[k] for k in ("id", "time", "player", "team", "x", "y", "shotXg", "shotDistance", "shotAngle", "shotPressure")} if shot else None,
                event={k: event[k] for k in ("id", "time", "player", "team", "type", "x", "y")} if event else None)


def check_proposal(facts, proposal):
    if (not isinstance(proposal, dict) or set(proposal) != {"id", "angle", "claimIds"}
            or proposal["id"] != facts["candidate"]["id"] or proposal["angle"] not in facts["claims"]):
        raise ValueError("Wrong insight identity/angle")
    ids = proposal["claimIds"]
    if (not isinstance(ids, list) or not 4 <= len(ids) <= 9 or len(set(ids)) != len(ids)
            or not set(ids) <= set(facts["claims"]) or not {"event", "score", "team0", "team1", proposal["angle"]} <= set(ids)
            or "player" in facts["claims"] and "player" not in ids):
        raise ValueError("Unverified insight claims")
    return proposal


def check_plan(facts, proposal, plan):
    check_proposal(facts, proposal)
    if not isinstance(plan, dict) or set(plan) != {"id", "modes"} or plan["id"] != proposal["id"] or set(plan["modes"]) != set(AUDIENCES):
        raise ValueError("Wrong presentation identity")
    for audience, ids in plan["modes"].items():
        if (not isinstance(ids, list) or not 1 <= len(ids) <= 5 or len(set(ids)) != len(ids)
                or not set(ids) <= set(proposal["claimIds"])):
            raise ValueError("Unverified edition")
        required = {"club_home": "team0", "club_away": "team1", "player": "player" if facts["actor"] else "score", "fan": "event", "broadcast": "event"}.get(audience)
        if required and required not in ids:
            raise ValueError("Wrong audience attribution")
    if plan["modes"]["fan"] == plan["modes"]["analyst"]:
        raise ValueError("Undifferentiated editions")
    return plan
