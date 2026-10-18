# TacticLens Live

**Evidence-backed football intelligence, one event at a time.**

An original, entirely fictional proof-of-concept for Microsoft's **Inside the Game** hackathon. It replays deterministic synthetic football events, derives statistics in code, identifies an explainable change in high recoveries, and lets viewers inspect the underlying event IDs and calculation.

> **Status: playable prototype.** Microsoft Foundry agents and cloud deployment are planned next, **not yet implemented**. No official Premier League data, match footage, or licensed assets are included.

## Run locally

Requires Python 3.10+ and Node.js 20+.

Terminal 1 (from repository root):

    python -m venv .venv
    source .venv/bin/activate
    pip install -r api/requirements.txt
    python -m uvicorn api.main:app --reload --port 8000

On Windows, activate with \`.venv\\Scripts\\activate\`.

Terminal 2:

    cd web
    npm install
    npm run dev

Open **http://localhost:5173**. Vite proxies \`/api\` to FastAPI on port 8000.

## Demo flow

1. Click **Jump to insight** (or scrub the 90-minute timeline to 75:00).
2. Open the new insight and its **Evidence Trail**.
3. Switch between **Fan**, **Analyst**, and **Broadcast** perspectives.
4. Inspect the exact event IDs and two comparison windows.
5. Restart the match and use **12×** replay to see events develop.

## API

- \`GET /api/health\` — health check
- \`GET /api/match\` — fictional teams, events, precomputed deterministic insight
- \`GET /api/stats?at=4500\` — historical replay snapshot

## Tests

    python -m pytest api/tests -q

## How the metrics work

Events come from a repeatable seeded simulator. A shot count includes goals; a goal is a separate event kind, so it is counted once. Control share is computed from synthetic **control_seconds** assigned to on-ball events: it is a teaching approximation, **not official possession or real-world tracking**.

The tactical insight compares north-side recovery events with coordinate \`x >= 67\` in the windows [55:00, 65:00) and [65:00, 75:00). Evidence IDs are drawn directly from the stream. No AI-generated statistics or speculative tactical causation are required.

## Roadmap

- [x] Synthetic match generator with fixed seed
- [x] Deterministic statistics and tested evidence trail
- [x] Interactive replay and multiple presentation modes
- [ ] Microsoft Foundry-backed insight and verification agents
- [ ] Agent-trace instrumentation and reliability evaluation
- [ ] Azure deployment and anonymous judge access
- [ ] Two-minute demo, submission package, accessibility review

## Data and licensing

All teams and players are fictional; all events are generated procedurally in this project. No official league marks or broadcasts are used. Do not mistake this demonstration for a live football analytics service.
