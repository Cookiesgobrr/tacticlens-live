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

## Recording-ready walkthrough (1:55)

Use the public seed 82 link above. The UI now defaults to that seed, while the simulation's general-purpose default and calibration remain unchanged. Keep **1×** for a visible four-second shot/goal sequence. “Next AI moment” seeks to four seconds before the next cached moment and plays it; seeking does not change the simulation result.

| Recording time | Action | Voiceover / claim |
| --- | --- | --- |
| 0:00–0:12 | Start at kickoff; press Play. | “TacticLens makes football explanations inspectable. Twenty-two fictional players and every statistic share one deterministic match timeline.” |
| 0:12–0:25 | Toggle 3D, try broadcast/tactical camera. | “The 2D and 3D views render the same recorded coordinates. No separate game or invented tracking data.” |
| 0:25–0:40 | Show the second goal around **39:03.75** and the **0–2** score. Use Next AI moment from shortly before the goal if needed. | “Southbridge lead two-nil. This is a naturally generated seed, not a scripted score.” |
| 0:40–0:55 | Show the first Northport goal at **50:10**, then use Next AI moment toward the equalizer. | “Northport begin their comeback. Foundry has precomputed the evidence for these actual SIM-82 moments.” |
| 0:55–1:10 | Show **76:25.25** (2–2), then **78:00.25** (3–2), playing the last few seconds of the winning shot. | “The equalizer and winner are ninety-five seconds apart. The winner comes from shot SIM-82-01628, followed by goal SIM-82-01629.” |
| 1:10–1:28 | Scroll to the Foundry card. Switch Fan → Analyst → Club supporter; select Northport, or Player and S. Grant. Expand the agent trace briefly. | “Three real GPT-4.1-mini agents select, independently review and compose the evidence. Code verifies the facts and controls factual wording. Different audiences receive different evidence compositions.” |
| 1:28–1:40 | Click the winning source shot, then return to the winning moment. | “Every explanation links to its actual replay event and pre-outcome scoring probability. Rewinding before the winner removes that result and its AI card.” |
| 1:40–1:50 | Advance a few seconds after the goal; export AI moment JSON and AI broadcast VTT from the expanded trace. | “Verified compositions export as source-linked evidence and timed broadcast captions. Viewer interactions make no model calls.” |
| 1:50–1:55 | Seek to **90:00**, finish on the 3D view / 3–2 scoreboard. | “Twenty-two shots, 2.57 synthetic xG, and an inspectable three-two comeback. Two hundred deterministic matches tested.” |

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
- Engine/evaluation: `web/src/footballEngine.ts`, `docs/evaluation/README.md`
- Source-event and broadcast exports: `docs/EVIDENCE_EXPORT.md`
- Foundry boundary: `docs/PUBLIC_FOUNDRY_DASHBOARD.md`
- Final submission/AI integration: https://github.com/Cookiesgobrr/tacticlens-live/issues/30
