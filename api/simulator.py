"""Deterministic, wholly fictional football event stream.

Each on-ball event carries a synthetic control-time estimate. This is NOT
tracking-data possession or official football statistics.
"""
from __future__ import annotations

import random

SEED = 20261018
DURATION_SECONDS = 90 * 60
TEAMS = [
    {"id": "north", "name": "Northport FC", "short": "NOR", "color": "#c6fa65"},
    {"id": "south", "name": "Southbridge Athletic", "short": "SOU", "color": "#77aaff"},
]

PLAYERS = {
    "north": ["A. Vale", "J. Okoro", "M. Santos", "R. Ellis", "D. Chen", "L. Mensah"],
    "south": ["T. Rahman", "B. Cole", "I. Moreno", "K. Park", "S. Ndlovu", "E. Brooks"],
}


def _event(second: int, team: str, kind: str, x: float, y: float,
           player: str, control: int = 0, label: str = "") -> dict:
    return {
        "id": "",
        "second": second,
        "minute": second // 60,
        "team": team,
        "player": player,
        "kind": kind,
        "x": round(x, 1),
        "y": round(y, 1),
        "control_seconds": control,
        "description": label or kind.title(),
    }


def build_match(seed: int = SEED) -> dict:
    """Generate a stable scenario with a visible second-half pressing shift."""
    rng = random.Random(seed)
    events: list[dict] = []
    second = 0
    current_team = "south"

    while second < DURATION_SECONDS:
        duration = rng.randint(10, 24)
        second = min(second + duration, DURATION_SECONDS - 1)
        if rng.random() < 0.23:
            current_team = "north" if current_team == "south" else "south"

        if current_team == "north":
            attacking = second >= 63 * 60
            x = rng.uniform(52, 91) if attacking else rng.uniform(25, 82)
        else:
            x = rng.uniform(12, 77)
        y = rng.uniform(9, 91)
        kind = rng.choices(
            ["pass", "carry", "recovery", "turnover", "shot", "pressure"],
            weights=[52, 21, 5, 10, 5, 7],
        )[0]
        player = rng.choice(PLAYERS[current_team])
        control = duration if kind in ("pass", "carry", "shot") else 0
        descriptions = {
            "pass": f"{player} completes a pass",
            "carry": f"{player} advances with the ball",
            "recovery": f"{player} wins possession",
            "turnover": f"{player} loses possession",
            "shot": f"{player} takes a shot",
            "pressure": f"{player} applies pressure",
        }
        events.append(_event(second, current_team, kind, x, y, player,
                             control, descriptions[kind]))

    # Deliberately constructed scenario, not a historical football assertion.
    # These recoveries create a reproducible shift that can be explained.
    for minute in (65, 66, 67, 68, 70, 71, 72, 73):
        second = minute * 60 + 13
        player = PLAYERS["north"][minute % len(PLAYERS["north"])]
        events.append(_event(second, "north", "recovery", 74 + minute % 12,
                             24 + (minute * 9) % 51, player, 0,
                             f"{player} wins the ball high up the pitch"))

    for second, team, player in [
        (26 * 60 + 16, "south", "I. Moreno"),
        (76 * 60 + 38, "north", "J. Okoro"),
    ]:
        events.append(_event(second, team, "goal", 92 if team == "north" else 8,
                             49, player, 0, f"GOAL! {player} scores"))

    events.sort(key=lambda e: (e["second"], e["kind"]))
    for index, event in enumerate(events, start=1):
        event["id"] = f"EVT-{index:04d}"

    return {
        "match_id": "TLL-DEMO-001",
        "title": "A fictional football match",
        "disclaimer": "All teams, players, events and metrics are synthetic demonstration data.",
        "seed": seed,
        "duration_seconds": DURATION_SECONDS,
        "teams": TEAMS,
        "events": events,
    }
