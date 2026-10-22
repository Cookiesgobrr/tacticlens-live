# Judge demo — 1 minute 50 seconds

## Reproducible showcase: Northport 3–2 Southbridge

Open **https://cookiesgobrr.github.io/tacticlens-live/?seed=82**. This is a real deterministic outcome of the unchanged 11v11 simulator, **not a forced or scripted score**. Northport FC recover from 0–2 to win 3–2, with **22 combined shots** and **2.57 total synthetic xG**. The final lead change takes place in a 95-second interval late in the match.

| Match time | Score after goal | Scorer | Goal event ID | Supporting shot ID |
| --- | --- | --- | --- | --- |
| 13:29 | Northport 0–1 Southbridge | M. Silva | `SIM-82-00282` | `SIM-82-00281` |
| 39:03 | Northport 0–2 Southbridge | M. Silva | `SIM-82-00826` | `SIM-82-00825` |
| 50:10 | Northport 1–2 Southbridge | S. Grant | `SIM-82-01053` | `SIM-82-01052` |
| 76:25 | Northport 2–2 Southbridge | S. Grant | `SIM-82-01597` | `SIM-82-01596` |
| 78:00 | Northport 3–2 Southbridge | S. Grant | `SIM-82-01629` | `SIM-82-01628` |

This exact timeline was checked by running the production TypeScript `generateMatch(82)` on GitHub Actions. The goal event IDs and source shot IDs are independently reproducible. Use seed 82 for the verified story. Other UI seeds now use formation engine v2 and distinct evidence IDs; their outcomes are not the archived classic-seed examples.

## Recording-ready walkthrough (1:50)

Open the public seed 82 link in a 1440×1000 browser. The default is **3D / Broadcast / Low graphics** with a nearby Microsoft Foundry companion. Leave the agent audit collapsed until the proof segment. Use 1× so the ball visibly travels through each source shot. Avoid scrolling the match out of view during the comeback.

For a judge demonstration, deliberately enable **Full-match review (reveals results)** under Key moments and choose **Goals**. This exposes the five genuine source-linked goal buttons. Clicking a goal replays from four seconds before its source shot through five seconds after it, using the current renderer/camera. Live-style playback keeps future highlights hidden by default.

| Recording time | Action | Voiceover / supported claim |
| --- | --- | --- |
| 0:00–0:12 | Play kickoff in the default 3D broadcast. Use Zoom in and Reset camera. | “TacticLens turns a football broadcast into something you can inspect. The camera follows the ball, while every event and statistic shares one deterministic timeline.” |
| 0:12–0:28 | Enable full-match review, filter Goals, click **0–2 at 39:03**. Let the source shot and goal play. | “Southbridge lead two-nil. This is a naturally simulated result, not a score written for the demo.” |
| 0:28–0:40 | Replay **1–2 at 50:10**. | “Northport pull one back. Genuine Foundry agents have selected and verified the evidence behind this match.” |
| 0:40–0:58 | Replay **2–2 at 76:25**, then **3–2 at 78:00**. Keep the broadcast camera on the final shot. | “Two goals ninety-five seconds apart complete the turnaround. The scorer, ball flight, score and explanation all refer to the same events.” |
| 0:58–1:18 | Switch Fan → Analyst → Club supporter (Southbridge) → Player (S. Grant). | “The same verified facts become different evidence compositions: the fan story, the chance geometry, the opponent's view and the player's contribution. The camera and highlight priorities follow the perspective.” |
| 1:18–1:32 | Expand the agent trace. Show the three actual executions and export AI JSON / VTT. | “Insight, Verification and Presentation are three separate Microsoft Agent Framework agents using GPT-4.1-mini. Code independently checks facts and controls factual wording. These are real cached executions, not simulated live activity.” |
| 1:32–1:43 | Click source shot **SIM-82-01628**. Rewind just before the winner; briefly toggle 2D. | “Each explanation links to evidence. Rewind before the winner and both its result and AI card disappear. The 2D and 3D views share the same coordinates.” |
| 1:43–1:50 | Return to 3D; seek to **90:00** and collapse the audit. | “A three-two comeback, twenty-two shots, 2.57 synthetic xG. Three hundred deterministic matches tested across the original and formation engines. No inference calls while you watch.” |

A reproducible silent capture is available with `cd web && npm run test:production -- --record`. It uses the deployed app, real highlight clicks, camera zoom, perspectives and exports. Add narration/captions and check the resulting duration before upload; do not claim a silent capture is a completed submission.

### Exact timestamps and recording integrity

- Goal times in the first table are displayed football minutes. The exact underlying seconds are **809**, **2343.75**, **3010**, **4585.25**, **4680.25**. Seeking to 78:00.00 is still just before the winner; use Next AI moment and let it play through.
- At the winning goal there are **20 shots and about 2.41 xG** so far. The **22 shots / 2.57 xG** figures apply at full time; do not present those full-match totals early.
- The AI is **precomputed, constrained editorial generation**: actual agents choose evidence and audience ordering; deterministic code renders the approved fact sentences. Do not claim unrestricted LLM prose, predictive accuracy, real tracking or fresh inference on each click.
- The public cache contains seven genuine moments, including halftime and fulltime. Cards remain active for two match minutes. Other seeds, uncovered times or unmatched player views deliberately show a labelled deterministic fallback.
- Keep the agent trace collapsed during normal match viewing; expand it only for the proof segment. Avoid showing private Azure dashboards or credentials in the recording.
- Use a clear voiceover or captions. Upload an under-two-minute video to an accepted public/unlisted host and verify it plays without a judge signing in.
- The actual Innovation Studio form must receive the video URL and final submission confirmation. Development merges do not submit the entry.

## Submission references

- Live studio: https://cookiesgobrr.github.io/tacticlens-live/?seed=82
- Repository: https://github.com/Cookiesgobrr/tacticlens-live
- Broadcast/camera/version contracts: `docs/BROADCAST_EXPERIENCE.md`
- Engine/evaluation: `web/src/footballEngine.ts`, `docs/evaluation/README.md`
- Source-event and broadcast exports: `docs/EVIDENCE_EXPORT.md`
- Foundry boundary: `docs/PUBLIC_FOUNDRY_DASHBOARD.md`
- Final submission/AI integration: https://github.com/Cookiesgobrr/tacticlens-live/issues/30
