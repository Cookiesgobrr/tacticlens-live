# Judge demo — 1 minute 55 seconds

## Reproducible showcase: Northport 3–2 Southbridge

Open **https://cookiesgobrr.github.io/tacticlens-live/?seed=82**. This is a real deterministic outcome of the unchanged 11v11 simulator, **not a forced or scripted score**. Northport FC recover from 0–2 to win 3–2, with **22 combined shots** and **2.57 total synthetic xG**. The final lead change takes place in a 95-second interval late in the match.

| Match time | Score after goal | Scorer | Goal event ID | Supporting shot ID |
| --- | --- | --- | --- | --- |
| 13:29 | Northport 0–1 Southbridge | M. Silva | `SIM-82-00282` | `SIM-82-00281` |
| 39:03 | Northport 0–2 Southbridge | M. Silva | `SIM-82-00826` | `SIM-82-00825` |
| 50:10 | Northport 1–2 Southbridge | S. Grant | `SIM-82-01053` | `SIM-82-01052` |
| 76:25 | Northport 2–2 Southbridge | S. Grant | `SIM-82-01597` | `SIM-82-01596` |
| 78:00 | Northport 3–2 Southbridge | S. Grant | `SIM-82-01629` | `SIM-82-01628` |

This exact timeline was checked by running the production TypeScript `generateMatch(82)` on GitHub Actions. The goal event IDs and source shot IDs are independently reproducible. The previous judge example `seed=2027` ends 0–1 and should not be used in the final five-goal story.

## Suggested screen recording (1:55)

| Recording time | Action | Point to demonstrate |
| --- | --- | --- |
| 0:00–0:12 | Load seed 82 at kickoff, show formation; press Play. | “Twenty-two fictional players, one shared gameplay and evidence timeline.” |
| 0:12–0:27 | Toggle 3D, then switch broadcast/tactical camera while playing. | “2D and 3D use the exact same underlying match frames; no second 3D game engine.” |
| 0:27–0:45 | Back to 2D, seek to **39:03**; show **0–2** with the second goal and its source shot. | “The replay and statistics reproduce the same original recorded synthetic events.” |
| 0:45–1:02 | Seek to **50:10**; select Northport and S. Grant in Player view. | “TacticLens changes its perspective with the fan, analyst, club or player.” |
| 1:02–1:25 | Seek to **76:25**, then **78:00**; click shot evidence for `SIM-82-01628`. | “Northport equalize, then take the lead. Every goal is linked to its source shot and pre-outcome scoring probability.” |
| 1:25–1:40 | Show export evidence JSON and broadcast VTT, both bounded by current replay time. | “The same evidence is portable as timed, machine-readable broadcast cues.” |
| 1:40–1:50 | Show *genuine verified Foundry output for seed 82* **only if issue #30 has connected it and verified source IDs**; otherwise use the clearly labelled archived Foundry demo. | “Azure GPT-4.1-mini performs evidence-grounded explanations; old match AI is always labelled as separate.” |
| 1:50–1:55 | Finish on the 3–2 scoreboard and 3D pitch. | “One match, multiple perspectives, source-checkable intelligence.” |

### Recording integrity and limitations

- Verify deployed `main` has passed CI and browser checks. Until the selection PR is merged, `?seed=82` still works because it is an input to the unchanged seeded engine.
- The goal probabilities and xG are simplified synthetic estimates, **not trained or calibrated on actual professional football**.
- Do not describe rule-based new-match explanations as Foundry-generated. No `EVT-` ID from the archived match may be used as a `SIM-82-` source.
- If later agent integration chooses a different seed, either have it use **82**, or transparently demonstrate the two datasets separately. Prefer seed 82 for new 11v11 AI narratives and shot evidence.
- The demo video must be under two minutes and accessible without login to judges. Upload to a supported public/unlisted video host and submit its actual URL to Innovation Studio before the hackathon deadline.
- Avoid unnecessary additional Azure resource provisioning, free-trial upgrade or unbounded model inference.

## Submission references

- Live studio: https://cookiesgobrr.github.io/tacticlens-live/?seed=82
- Repository: https://github.com/Cookiesgobrr/tacticlens-live
- Engine/evaluation: `web/src/footballEngine.ts`, `docs/evaluation/README.md`
- Source-event and broadcast exports: `docs/EVIDENCE_EXPORT.md`
- Foundry boundary: `docs/PUBLIC_FOUNDRY_DASHBOARD.md`
- Final submission/AI integration: https://github.com/Cookiesgobrr/tacticlens-live/issues/30
