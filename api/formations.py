"""Auditable six-a-side kickoff arrangements for the fictional TacticLens demo.

This is a SIX-person-per-team dataset, so a real 11-a-side 4-3-3 would be
misleading. Pitch X is left/right in metres: Northport defends x=-50 and
Southbridge x=+50; Z is across the width. Kickoff is a presentation
reconstruction and does not create logged match events.
"""
from __future__ import annotations

from api.simulator import PLAYERS

KICKOFF_HOLD_SECONDS = 2
FORMATION = "1-2-1-2"
ROLE_COORDINATES = (
    ("GK", 46.0, 0.0),
    ("LB", 30.0, -16.0),
    ("RB", 30.0, 16.0),
    ("CM", 18.0, 0.0),
    ("LF", 14.0, -12.0),
    ("RF", 14.0, 12.0),
)


def opening_formation(match: dict) -> dict:
    """Return player anchors and a two-player kickoff assignment.

    Kicking team stays within their half apart from the center-spot taker.
    Defending side stays outside the 9.15m radius of the center circle.
    """
    events = sorted(match["events"], key=lambda e: (e["second"], e["id"]))
    kickoff_team = events[0]["team"] if events else "south"
    kicker = events[0]["player"] if events else PLAYERS[kickoff_team][-1]
    teammates = PLAYERS[kickoff_team]
    # Choose the adjacent named teammate for the short illustrative pass.
    supporter = teammates[(teammates.index(kicker) + 1) % len(teammates)]
    assignments: dict[str, dict] = {}
    for team, names in PLAYERS.items():
        # Northport starts on the left; Southbridge on the right.
        own_sign = -1 if team == "north" else 1
        if team == kickoff_team:
            other = [name for name in names if name not in (kicker, supporter)]
            for name, (role, x, z) in zip(other, ROLE_COORDINATES[:4]):
                assignments[f"{team}:{name}"] = {
                    "role": role, "x": own_sign * x, "z": z
                }
            assignments[f"{team}:{kicker}"] = {"role": "KICKER", "x": 0.0, "z": 0.0}
            assignments[f"{team}:{supporter}"] = {
                "role": "SUPPORT", "x": own_sign * 4.0, "z": 0.0
            }
        else:
            for name, (role, x, z) in zip(names, ROLE_COORDINATES):
                assignments[f"{team}:{name}"] = {
                    "role": role, "x": own_sign * x, "z": z
                }
    return {
        "formation": FORMATION,
        "players_per_side": len(PLAYERS["north"]),
        "kickoff_team": kickoff_team,
        "kicker_id": f"{kickoff_team}:{kicker}",
        "supporter_id": f"{kickoff_team}:{supporter}",
        "hold_seconds": KICKOFF_HOLD_SECONDS,
        "positions_m": assignments,
        "source": "synthetic-six-a-side-kickoff-reconstruction",
    }
