# Judge demo — 1 minute 55 seconds

Open https://cookiesgobrr.github.io/tacticlens-live/?seed=2027 before recording. Keep 2D available as the fallback. Seed 2027 is a reproducible showcase, not a change to the simulator's distribution or default seed. It has 19 combined shots, 1.206 total synthetic xG and a 0–1 final score. The default seed remains 2927 and can finish goalless.

| Recording time | Action | Point to explain |
| --- | --- | --- |
| 0:00–0:15 | Press Play; show 22 players and the passing sequence. | “TacticLens connects a fictional match to explanations you can inspect. The pitch, ball and statistics share one clock.” |
| 0:15–0:30 | Pause, select 3D studio, then tactical camera. | “2D and 3D render identical simulation frames. This is synthetic replay visualization.” |
| 0:30–0:50 | Return to 2D. Seek to 00:30, select Analyst, inspect the first shot. | “SIM-2027-00013 has an 11.7% pre-outcome scoring probability: 12.3 metres, 32° off centre and a defender 2.1 metres away. This simplified model is not calibrated to real matches.” |
| 0:50–1:05 | Seek briefly before 00:30, then to 76:48.25. | “Seeking backwards removes future shots and xG. M. Silva's goal cites SIM-2027-01589 as its source shot; the goal is SIM-2027-01590.” |
| 1:05–1:20 | Choose Player perspective and track M. Silva. Click an evidence action. | “Audience views use the same event evidence. Every linked action seeks to its actual replay time.” |
| 1:20–1:35 | Export evidence JSON and broadcast VTT. | “Portable evidence and timed captions stop at the current replay time. Tests reject fabricated totals, future events and unrelated match IDs.” |
| 1:35–1:50 | Open Archived AI evidence demo only if its cached feed is ready. | “Microsoft Foundry GPT-4.1-mini generated this separate archived example. We keep its old event IDs out of the new match's explanations.” If unavailable, show the labelled fallback and explain the boundary. |
| 1:50–1:55 | Finish on the match studio. | “200 deterministic matches, published outliers, tested replay evidence and a free public demo.” |

## Recording checks

- Wait for the latest Pages deployment to succeed. Use the published URL, not an unmerged branch.
- Test WebGL on the recording device; 2D remains fully functional.
- Do not describe rule-based narratives as Foundry-generated. Do not infer causation or real-world predictive accuracy from synthetic xG.
- No new model inference or billable cloud resources are required for this flow.

## Submission references

- Live studio: https://cookiesgobrr.github.io/tacticlens-live/
- Repository: https://github.com/Cookiesgobrr/tacticlens-live
- Calibration and limitations: `docs/evaluation/README.md`, `calibration.json`, `holdout.json`
- Architecture: repository README
- New-match evidence format: `docs/EVIDENCE_EXPORT.md`
- Archived Foundry boundary: `docs/PUBLIC_FOUNDRY_DASHBOARD.md`
- Task and acceptance criteria: https://github.com/Cookiesgobrr/tacticlens-live/issues/25

Use the current hackathon submission portal's deadline and required fields when submitting; this document is the demo plan, not a submitted entry.
