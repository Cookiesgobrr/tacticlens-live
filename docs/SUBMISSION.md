# TacticLens Live — submission package

## Project description

**TacticLens Live makes football explanations inspectable.** Watch a fictional 11v11 match in 2D or 3D, switch between fan, analyst, club supporter and player perspectives, and follow every explanation back to the event that supports it. Microsoft Foundry agents select, verify and compose the evidence. Independent code checks protect the statistics, timestamps and source IDs. The same verified moments can become portable broadcast captions.

The demonstration follows Northport's naturally simulated **3–2 comeback from 0–2**, including a late equalizer and winning goal. The score is reproduced from seed 82, rather than scripted for the presentation.

## Why it matters

Football dashboards often separate a compelling story from the numbers and replay supporting it. TacticLens keeps those connected. A viewer can inspect a source shot, compare its synthetic chance quality with the result, change the audience perspective and export the evidence. The AI's editorial work is visible through a three-stage trace; model approval cannot override the deterministic evidence gate.

## What is built

- One deterministic TypeScript match engine supplies all 22 players, possession, ball movement, goals, statistics and event IDs.
- React/SVG and Three.js render the same replay frames. WebGL failure returns to a working 2D view.
- Three separate Microsoft Agent Framework agents—Insight, Verification and Presentation—use the existing Azure Foundry GPT-4.1-mini deployment.
- Seven genuine precomputed seed 82 moments contain six evidence compositions: Fan, Analyst, two Club Supporter views, Player and Broadcast.
- Independent TypeScript and Python checks verify match identity, source events, time, attribution, counts and synthetic xG. The browser rechecks facts before showing a cached result.
- Public replay performs no inference. Invalid caches and unsupported seeds/player moments have an honest deterministic fallback.
- JSON and WebVTT exports include source IDs. The AI-moment exports include the provider, generation time, composition and agent trace.

## Architecture and evaluation

See [the implemented Foundry workflow and exact execution trace](FOUNDRY_11V11.md), [the repository architecture](../README.md), [200-seed calibration](evaluation/README.md) and [export format](EVIDENCE_EXPORT.md).

Evaluation includes mutation tests for fabricated scores, altered xG, future source IDs, another seed, wrong actors, invented presentation claims and a verifier veto. Browser tests exercise actual cached AI, seek boundaries before/after the winner, audience changes, source links, downloads, tampered-cache rejection, desktop/mobile layout, 2D/3D coordinate parity and WebGL fallback. These are prototype integrity tests, not a real-world football prediction benchmark.

## Demonstration links

- Live: https://cookiesgobrr.github.io/tacticlens-live/?seed=82
- Repository: https://github.com/Cookiesgobrr/tacticlens-live
- Recording guide: [1:55 judge walkthrough](JUDGE_DEMO.md)
- Genuine generated cache: [foundry-sim82.json](../web/public/data/foundry-sim82.json)
- Execution audit: [foundry-sim82-audit.json](evaluation/foundry-sim82-audit.json)
- Video URL: **add the final accessible video link before submitting**.

## Optional silent capture

After deployment, `cd web && npm run test:production -- --record` checks the actual public site and captures a silent walkthrough in `web/test-results/production/demo-silent.webm`. Install Chromium and Playwright FFmpeg first (`npx playwright install chromium ffmpeg`), or set `CHROMIUM_PATH` to an existing Chrome executable. This capture contains real UI interactions, source clicks and genuine cached results; it is a starting point for a voiceover/captioned judge video, not a portal submission. Review its duration and content before upload. The same script without `--record` is the production smoke check.

## Claims and limitations to keep explicit

All teams, players and events are fictional. Coordinates are simulated, not measured tracking. xG is a simplified synthetic model, not calibrated to professional matches. The AI performs constrained evidence selection and composition; code supplies audited factual sentences. The results are precomputed, not fresh inference on every interaction. The archived six-a-side Foundry demonstration is separate and does not explain SIM-82. The three agents share a model deployment. This is a hackathon prototype with simplified football rules and restarts.

## Submission checklist

Before **October 27, 2026, 11:59 PM Pacific** (October 28, 10:59 AM Dubai), complete the actual Innovation Studio submission. Prefer finishing a day earlier. This repository and its pull requests do not submit the project.

- [ ] Record the actual deployed seed 82 application using the 1:55 script; include the genuine Foundry card, source-shot click-through, audience change and exports.
- [ ] Upload the video to an accepted public/unlisted host such as YouTube or Vimeo. Verify it plays without a judge signing in. Add captions or a clear voiceover.
- [ ] Copy the actual video URL into the Innovation Studio project; use this project description as the factual starting point and confirm the portal's current field limits.
- [ ] Add the live demo and public repository links; confirm current official eligibility, judging criteria, required disclosures and submission fields in the portal.
- [ ] Open the live site in a private browser on desktop and phone. Check seed 82, 3–2 finish, Foundry badge, evidence links and both views.
- [ ] Confirm the latest main CI and Pages deployment are green, with no broken assets or exposed credentials.
- [ ] Submit in Innovation Studio and retain the actual confirmation. Do not call it submitted until that confirmation exists.
- [ ] Keep the GitHub repository and Pages deployment public and available through **November 10, 2026**. The new match uses static AI output and does not depend on Azure trial availability for judge visits.

Only the project owner can confirm the final portal submission. No video upload or Innovation Studio submission has been performed by this development change.
