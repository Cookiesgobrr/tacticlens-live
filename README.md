# TacticLens Live

**A football broadcast you can inspect. Personalized Microsoft Foundry intelligence, grounded in one fictional 11v11 match.**

[Open the public match studio](https://cookiesgobrr.github.io/tacticlens-live/?seed=82) · [Judge demo (under two minutes)](docs/JUDGE_DEMO.md) · [Calibration results](docs/evaluation/README.md)

The match studio connects the pitch, possession, passes, shots, xG, score and explanations to one simulation clock. Switch between SVG 2D and a stylized 3D view of the **same frames**, inspect a shot, follow its event IDs, and export the evidence visible at the current replay time.

## What works

- An original plum/green broadcast identity, compact scorebug and match-first desktop/mobile layouts. No official league assets or affiliation.
- 22 fictional players, bounded movement, receiving/interceptions, shots, keeper actions and restarts. Five real formations in a versioned mode for other seeds; the seed 82 showcase retains its exact original 4-3-3 engine.
- Replay seeking, wall-clock 1× playback, player focus, optional nearby stats, shot map and cumulative synthetic xG.
- Closer, damped ball/carrier-following broadcast camera; button, wheel/trackpad and two-finger zoom; tactical/player cameras, low/medium quality, flip and 2D fallback.
- Filtered source-linked highlights with pre-roll replay, explicit full-match review, and no future-event spoilers during live-style playback.
- Genuine precomputed Foundry AI evidence compositions for seven seed 82 moments, with Fan/Analyst/Club Supporter/Player views, visible agent trace and deterministic fallback.
- Replay-time JSON evidence and WebVTT broadcast captions, with deterministic validation against fabricated totals, future events and unrelated evidence.
- Population checks over 100 calibration and 100 holdout seeds. Means: 23.34 / 22.67 shots, 2.07 / 1.99 goals and 2.13 / 2.09 xG. Outliers are retained; full per-seed results are published.

**Microsoft Foundry now explains the new 11v11 match.** Three distinct Microsoft Agent Framework agents made three genuine GPT-4.1-mini calls to select, independently review and compose evidence for **SIM-82**. Code independently verifies the facts and renders approved factual sentences. This is constrained AI editorial generation, not unrestricted model prose or new inference on every click. [Implementation and audit](docs/FOUNDRY_11V11.md) · [Submission package](docs/SUBMISSION.md).

The primary UI defaults to seed 82, a naturally simulated 3–2 comeback. Other seeds remain available. Seed 82 and the classic population calibration remain unchanged. Other seeds in the UI use `formations-v2` and distinct `SIM-<seed>-F2` IDs. The older six-a-side source remains for reproducibility, with no public archive navigation; its `EVT-` evidence is never reused for SIM-82. [Broadcast contracts, versions and evaluation](docs/BROADCAST_EXPERIENCE.md).

## Run locally

Use Node.js **22.18+** for built-in TypeScript stripping and Python **3.10+** for the optional archived API.

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:5173. The primary match studio is client-side and needs no API credentials. For historical backend development (not public navigation), run `python -m pip install -r api/requirements.txt` and `python -m uvicorn api.main:app --reload --port 8000` from the repository root in another terminal. Vite proxies `/api` there.

## Verify

```sh
python -m pytest api/tests -q
cd web
npm ci
npm run test:match
npm run test:match -- --holdout
npm run test:formations
npm run test:camera
npm run test:highlights
npm run test:analysis
npm run test:evidence
npm run test:intelligence
npm run build
npx playwright install chromium
npm run test:browser
```

CI runs the backend tests, both populations, analysis/export checks, TypeScript/Vite build and Chromium smoke tests. Browser artifacts include desktop/mobile screenshots, 3D camera views and WebGL fallback checks. Publication uses the existing GitHub Pages workflow.

## Architecture

| Module | Responsibility |
| --- | --- |
| `web/src/footballEngine.ts` | Seeded simulation, sampled motion, possession, stable event IDs, replay interpolation and invariants |
| `web/src/FootballMatch2D.tsx` | Match controls and time-filtered 2D pitch, score and statistics |
| `web/src/formations.ts` | Deterministic shape/role/line inputs; versioned movement, protected seed 82 |
| `web/src/broadcastCamera.ts`, `MatchTimeline.tsx`, `matchHighlights.ts` | Camera composition/zoom, prefix-only highlight selection and coherent replays |
| `web/src/MatchPitch3D.tsx` | Presentation of the same current frame; no independent simulation |
| `web/src/momentIntelligence.ts`, `editorialCommentary.ts`, `FoundryMoment.tsx` | Prefix-bound Foundry cache validation, audience compositions, trace and evidence clicks |
| `api/eleven_pipeline.py`, `eleven_agents.py`, `precompute_eleven.py` | Independent source checks, three real agents and capped operator-only precomputation |
| `web/src/matchAnalysis.ts` | Deterministic audience explanations, totals and stat-label placement |
| `web/src/matchEvidence.ts` | Replay-time report/captions and strict deterministic report audit |
| `api/`, `LegacyApp.tsx`, `foundry.ts` | Archived dataset, backend evidence gates and cached Foundry demo |

## Scope and data

All teams, players and match events are fictional. No external league match data, footage or official marks are included. Coordinates are simulated, not real tracking. xG is a transparent synthetic probability model, not calibrated to professional football. The simulator currently simplifies restarts and has no offside, fouls/cards, fatigue or substitutions. See the [full methodology and limitations](docs/evaluation/README.md).

This is a hackathon prototype. The demo does not claim predictive accuracy or professional tracking. The 11v11 Foundry evidence is genuine and precomputed; its original audience-specific coverage is compiled from audited event claims. Detailed formation profiles separate measured positioning from Foundry-selected match context. See [the editorial and formation verification contract](docs/EDITORIAL_CONTRACT.md).
