"""11v11 agent orchestration with independent event checks and closed claim selection.

Models select evidence, editorial angle and audience order. Published factual
sentences are rendered from canonical claims, rather than trusting arbitrary
model prose. This is constrained AI editorial generation, not an LLM fact oracle.
"""
from __future__ import annotations
import math
from typing import Any

AUDIENCES = ("fan", "analyst", "club_home", "club_away", "player", "broadcast")
ANGLES = {"score", "chance", "sequence", "activity", "run", "player"}


def validate_source(source: dict) -> None:
    seed = source.get("seed")
    if (source.get("schemaVersion") != "tacticlens.source11.v1"
            or type(seed) is not int or not 1 <= seed <= 4294967295
            or source.get("matchId") != f"SIM-{seed}"):
        raise ValueError("Wrong source match")
    players, events = source["players"], source["events"]
    if len(players) != 22 or [p["id"] for p in players] != list(range(22)):
        raise ValueError("Invalid players")
    if [sum(p["team"] == t for p in players) for t in (0, 1)] != [11, 11]:
        raise ValueError("Invalid teams")
    seen, resolved = {}, set()
    last_time = -1
    for index, e in enumerate(events):
        if e["id"] != f"SIM-{seed}-{index+1:05d}" or not math.isfinite(e["time"]) or not last_time <= e["time"] <= 5400:
            raise ValueError("Invalid source ID/time")
        last_time = e["time"]
        if type(e["player"]) is not int or not 0 <= e["player"] < 22 or players[e["player"]]["team"] != e["team"]:
            raise ValueError("Invalid attribution")
        if not all(math.isfinite(e[k]) and 0 <= e[k] <= b for k, b in [("x", 105), ("y", 68)]):
            raise ValueError("Invalid coordinates")
        if e["type"] == "shot":
            d = math.hypot((105 if e["team"] == 0 else 0)-e["x"], 34-e["y"])
            angle = math.atan2(abs(e["y"]-34), max(1, abs((105 if e["team"] == 0 else 0)-e["x"])))
            probability = max(.005, min(.55, .39*math.exp(-max(0, d-6)/12)*max(.08, min(1, math.cos(angle)**2))*max(.5, min(1, .5+e["shotPressure"]*.1))))
            if abs(d-e["shotDistance"]) > 1e-7 or abs(angle*180/math.pi-e["shotAngle"]) > 1e-7 or abs(probability-e["shotXg"]) > 1e-9:
                raise ValueError("Shot geometry/xG mismatch")
        if e.get("sourceId"):
            action = seen.get(e["sourceId"])
            if action is None or action["time"] >= e["time"] or action["id"] in resolved:
                raise ValueError("Invalid action lineage")
            expected_type = "shot" if e["type"] in ("goal", "save", "miss") else "pass"
            if action["type"] != expected_type:
                raise ValueError("Wrong source action")
            if e["type"] == "goal" and (action["team"] != e["team"] or action["player"] != e["player"]):
                raise ValueError("Wrong goal attribution")
            resolved.add(action["id"])
        elif e["type"] in ("goal", "save", "miss", "receive", "loose"):
            raise ValueError("Missing source action")
        seen[e["id"]] = e
    expected_times = sorted([e["time"] for e in events if e["type"] == "goal"]+[2700, 5400])
    if [m["atSecond"] for m in source["moments"]] != expected_times:
        raise ValueError("Wrong trigger moments")
    for moment in source["moments"]:
        verify_moment(source, moment)


def verify_moment(source: dict, moment: dict) -> None:
    """Recalculate numerical facts in Python from the original event prefix."""
    at = moment["atSecond"]
    if (moment["seed"] != source["seed"] or moment["matchId"] != source["matchId"]
            or moment["id"] != f"{source['matchId']}@{at:g}"):
        raise ValueError("Wrong moment identity")
    visible = [e for e in source["events"] if e["time"] <= at]
    goals = [e for e in visible if e["type"] == "goal"]
    shots = [e for e in visible if e["type"] == "shot"]
    pair = lambda rows, kind: [sum(e["team"] == t and e["type"] == kind for e in rows) for t in (0, 1)]
    recent = [e for e in visible if e["time"] > at-600]
    previous = [e for e in visible if at-1200 < e["time"] <= at-600]
    latest = goals[-1] if goals else None
    shot = next((e for e in shots if latest and e["id"] == latest["sourceId"]), None)
    team, player = (latest["team"], latest["player"]) if latest else (0, 9)
    run = 0
    for e in reversed(goals):
        if e["team"] != team:
            break
        run += 1
    chain = []
    if shot:
        for e in reversed(visible):
            if e["time"] > shot["time"]:
                continue
            if e["time"] < shot["time"]-15 or (e["type"] in ("pass", "receive", "tackle", "interception", "recovery", "save") and e["team"] != team):
                break
            if e["team"] == team and e["type"] in ("pass", "receive"):
                chain.insert(0, e)
    pg = [e for e in goals if e["player"] == player]
    ps = [e for e in shots if e["player"] == player]
    expected = dict(score=pair(visible, "goal"), shots=pair(visible, "shot"),
        xg=[round(sum(e["shotXg"] for e in shots if e["team"] == t), 3) for t in (0, 1)],
        recentShots=pair(recent, "shot"), previousShots=pair(previous, "shot"), run=run,
        completedBuildup=sum(e["type"] == "receive" for e in chain), playerGoals=len(pg), playerShots=len(ps),
        goalId=latest["id"] if latest else None, shotId=shot["id"] if shot else None)
    if expected != moment["checks"] or moment["player"] != player or moment["team"] != team:
        raise ValueError("Numerical/timing/actor evidence mismatch")
    evidence = {"score": goals, "totals": shots, "activity": [e for e in previous+recent if e["type"] == "shot"]}
    for t in (0, 1):
        evidence[f"team{t}"] = [e for e in visible if e["team"] == t and e["type"] in ("shot", "goal")]
    if latest:
        evidence.update(goal=[shot, latest], chance=[shot], sequence=chain+[shot], run=goals[-run:], player=pg+ps)
    if {c["id"] for c in moment["claims"]} != set(evidence):
        raise ValueError("Wrong claim set")
    for c in moment["claims"]:
        expected_ids = list(dict.fromkeys(e["id"] for e in evidence[c["id"]]))
        if c["evidenceIds"] != expected_ids or not isinstance(c["text"], str) or not c["text"]:
            raise ValueError("Invalid/future claim evidence")


def check_proposal(source: dict, proposal: Any) -> dict:
    if not isinstance(proposal, dict) or set(proposal) != {"cards"} or not isinstance(proposal["cards"], list):
        raise ValueError("Invalid Insight output")
    cards = proposal["cards"]
    if len(cards) != len(source["moments"]) or [c.get("id") for c in cards] != [m["id"] for m in source["moments"]]:
        raise ValueError("Missing/wrong moment IDs")
    for c, m in zip(cards, source["moments"]):
        if set(c) != {"id", "angle", "claimIds"} or c["angle"] not in ANGLES:
            raise ValueError("Unsupported editorial angle")
        ids = c["claimIds"]
        if not isinstance(ids, list) or not 3 <= len(ids) <= 10 or len(set(ids)) != len(ids) or c["angle"] not in ids or not set(ids) <= {f["id"] for f in m["claims"]}:
            raise ValueError("Fabricated/duplicate claim")
    return proposal


def check_presentation(source: dict, proposal: dict, presentation: Any) -> list[dict]:
    if not isinstance(presentation, dict) or set(presentation) != {"cards"} or not isinstance(presentation["cards"], list) or len(presentation["cards"]) != len(proposal["cards"]):
        raise ValueError("Invalid Presentation output")
    result = []
    for m, chosen, p in zip(source["moments"], proposal["cards"], presentation["cards"]):
        if set(p) != {"id", "modes"} or p["id"] != m["id"] or set(p["modes"]) != set(AUDIENCES):
            raise ValueError("Wrong audience/moment")
        for mode, ids in p["modes"].items():
            if not isinstance(ids, list) or not 1 <= len(ids) <= 3 or len(set(ids)) != len(ids) or not set(ids) <= set(chosen["claimIds"]):
                raise ValueError("Unverified presentation claims")
            if mode == "player" and "player" in chosen["claimIds"] and "player" not in ids:
                raise ValueError("Player perspective lacks player evidence")
            if mode == "club_home" and not {"team0", "score"} & set(ids) or mode == "club_away" and not {"team1", "score"} & set(ids):
                raise ValueError("Supporter perspective lacks team context")
        if p["modes"]["fan"] == p["modes"]["analyst"]:
            raise ValueError("Audience perspectives are identical")
        result.append(dict(moment=m, angle=chosen["angle"], selectedClaimIds=chosen["claimIds"], modes=p["modes"]))
    return result


async def run_eleven_pipeline(source: dict, backend, *, moment_at: float | None = None) -> dict:
    """Verify the entire source before showing agents a *single* approved moment.

    The full batch continues to behave exactly as before when moment_at is
    omitted. Live mode never transmits future moments to an agent.
    """
    validate_source(source)
    scoped = source
    if moment_at is not None:
        moments = [m for m in source["moments"] if m["atSecond"] == moment_at]
        if len(moments) != 1:
            raise ValueError("Only a logged, preapproved goal/half/full moment is eligible")
        scoped = {**source, "moments": moments}
    facts = {"matchId": source["matchId"], "seed": source["seed"], "moments": scoped["moments"]}
    proposal = check_proposal(scoped, await backend.propose(facts))
    review = await backend.verify(facts, proposal)
    if (not isinstance(review, dict) or set(review) != {"approved", "checkedMomentIds", "issues"}
            or review["approved"] is not True or review["issues"] != []
            or review["checkedMomentIds"] != [m["id"] for m in scoped["moments"]]):
        raise ValueError("Verification agent vetoed publication")
    cards = check_presentation(scoped, proposal, await backend.present(facts, proposal))
    return {"cards": cards, "decisions": {"insight": proposal, "verification": review}}
