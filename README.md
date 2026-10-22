# TacticLens Live

**Explainable match intelligence from one deterministic, fictional 11v11 match.**

[Open the public match studio](https://cookiesgobrr.github.io/tacticlens-live/) · [Judge demo (under two minutes)](docs/JUDGE_DEMO.md) · [Calibration results](docs/evaluation/README.md)

The match studio connects the pitch, possession, passes, shots, xG, score and explanations to one simulation clock. Switch between SVG 2D and a stylized 3D view of the **same frames**, inspect a shot, follow its event IDs, and export the evidence visible at the current replay time.

## What works

- 22 fictional players in 4-3-3 shapes, bounded movement, receiving/interceptions, shots, keeper actions and restarts.
- Replay seeking, wall-clock 1× playback, player focus, optional nearby stats, shot map and cumulative synthetic xG.
- Broadcast/tactical/player 3D cameras, low/medium quality, pitch flip and 2D fallback when WebGL is unavailable.
- Rule-based Fan/Analyst/Club/Player explanations tied to new 11v11 event IDs.
- Replay-time JSON evidence and WebVTT broadcast captions, with deterministic validation against fabricated totals, future events and unrelated evidence.
- Population checks over 100 calibration and 100 holdout seeds. Means: 23.34 / 22.67 shots, 2.07 / 1.99 goals and 2.13 / 2.09 xG. Outliers are retained; full per-seed results are published.

**Microsoft Foundry integration is separate.** The “Archived AI evidence demo” can read cached, previously generated GPT-4.1-mini narratives for an older synthetic dataset. Those narratives do not explain the new 11v11 match. The primary match studio makes no model calls. See [the integration boundary](docs/PUBLIC_FOUNDRY_DASHBOARD.md).

## Run locally

Use Node.js **22.18+** for built-in TypeScript stripping and Python **3.10+** for the optional archived API.

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:5173. The primary match studio is client-side and needs no API credentials. For the archived view, run `python -m pip install -r api/requirements.txt` and `python -m uvicorn api.main:app --reload --port 8000` from the repository root in another terminal. Vite proxies `/api` there.

## Verify

```sh
python -m pytest api/tests -q
cd web
npm ci
npm run test:match
npm run test:match -- --holdout
npm run test:analysis
npm run test:evidence
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
| `web/src/MatchPitch3D.tsx` | Presentation of the same current frame; no independent simulation |
| `web/src/matchAnalysis.ts` | Deterministic audience explanations, totals and stat-label placement |
| `web/src/evidenceExport.ts` | Replay-time report/captions and strict deterministic report audit |
| `api/`, `LegacyApp.tsx`, `foundry.ts` | Archived dataset, backend evidence gates and cached Foundry demo |

## Scope and data

All teams, players and match events are fictional. No external league match data, footage or official marks are included. Coordinates are simulated, not real tracking. xG is a transparent synthetic probability model, not calibrated to professional football. The simulator currently simplifies restarts and has no offside, fouls/cards, fatigue or substitutions. See the [full methodology and limitations](docs/evaluation/README.md).

This is a hackathon prototype. The demo does not claim predictive accuracy, professional tracking or new Foundry evidence for 11v11 matches.
