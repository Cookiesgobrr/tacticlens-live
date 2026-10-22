# Broadcast experience and replay contracts

## One source, two views

The SVG and Three.js views consume the same `atTime` frame: 22 player positions, ball coordinates/height, ownership, phase, speed and distance. Neither renderer creates a pass, goal, interception or independent ball trajectory. The replay-prefix event log supplies every score, statistic, highlight and explanation.

`broadcastCamera.ts` composes the current ball/carrier with the known destination of an in-flight pass. Camera position and aim are damped separately; intentional seeks, mode changes, flips and reset snap to the correct composition. Broadcast starts closer than the old 100 m high camera. Tactical preserves a full-pitch overview; Player expands to keep the ball in context when the selected actor is far away. User zoom is bounded to 0.7–1.8×, with buttons, wheel/trackpad and two-touch gestures. Touch handlers suppress accidental player selection after a pinch. Single-finger vertical scrolling remains native. Reset restores the default distance and composition.

Boot meshes, speed/distance-driven gait, damped turns, kick preparation/follow-through, receiving gestures, keeper reaches and a brief scorer gesture are **animation approximations** around authoritative coordinates. They add no evidence. The simplified engine's ball stops at the goal line during its goal pause; no renderer invents a post-goal ball simulation. These stylized figures are not motion-captured or anatomically realistic.

## Highlights and personalization

Key moments select actual goals, shots, logged misses, saves, tackles, interceptions and recoveries. A big chance means at least 20% synthetic xG. A five-pass sequence is derived from five consecutive same-team completed passes; all ten pass/receipt IDs remain inspectable. Selection is prefix-only unless the viewer explicitly enables **Full-match review (reveals results)**.

Selecting a highlight starts four seconds before its source shot/action, runs at 1× through five seconds after the incident and retains the current renderer/camera. Exact source inspection remains a separate paused seek. Live-style playback does not expose future events or future AI. Club and Player perspectives prioritize that team/actor's highlights. Analyst selects the tactical camera; Player selects the ball-aware player camera.

The plum/green visual system is original. It uses no Premier League logo, lion, proprietary graphic or claim of affiliation. Intelligence sits beside the pitch on desktop and immediately after highlights on mobile. Secondary analytics collapse.

## Genuine AI, preserved

Seven seed 82 moments still use the original three real Foundry calls and unchanged public cache. The visible Insight → Verification → Presentation path represents **completed cached execution**, not live agent activity. Trace expansion shows actual response IDs, token usage and latency. A dismissible pitch graphic links to the current verified insight. AI replay and exports retain prefix restrictions.

Outside a supported time/player/seed, the UI explicitly labels its deterministic commentary. Canonical facts, claim wording, execution audit, free-trial protections and browser cache validation remain intact. This phase made **zero Azure calls** and provisioned nothing.

## Formation versions

`generateMatch(seed)` keeps the classic engine and its published calibration. `generateMatch(seed, {version: 'formations-v2'})` selects real 4-3-3, 4-2-3-1, 4-4-2, 3-5-2 or 4-1-4-1 shapes deterministically. Their nominal lines, width, defensive compression and DM/AM depth affect movement, passing geometry and nearest-player pressing. Goalkeepers remain a distinct role. The UI uses v2 for other seeds and shows optional actual kickoff diagrams.

**Seed 82 always uses classic-v1**, including when v2 is requested. Its match ID stays `SIM-82`. V2 matches use `SIM-<seed>-F2` to avoid confusing their evidence with classic outcomes; deterministic JSON exports include the engine version and formations. The full seed 82 motion/ownership/speed/distance/event SHA256 is guarded by `check-camera.mjs`:

`c66c53cffd774f4a5598da9fb3262aaee24aa538ba3d726cf2e0e0d6451026c0`

The unchanged Foundry cache SHA256 is:

`ea1982c5730bd29060ec99416033d636152020e69081487ef8411d1b653d8c1d`

## Evaluation

- Existing classic populations: 100 calibration + 100 held-out seeds, unchanged metrics.
- V2: seeds 1–50 and 1001–1050, all five formations, 100 matches, all motion/ownership/event-source invariants. Means: 19.37 shots, 2.13 goals, 2.237 synthetic xG. [Complete rows](evaluation/formations-v2.json). These are simulator checks, not professional-football validation.
- Camera: sample the entire match across all three modes, flip and zoom bounds; verify finite poses and ball inclusion in the projected frustum. Exact seed 82 state digest is mandatory.
- Highlights: exact five original goals/IDs/timestamps/scores, time-prefix restrictions and sourced passing sequences.
- Browser: actual playback, trusted Chromium pinch input, wheel/reset, moving-shot framing, all renderer coordinates, highlight pre-roll, spoiler toggle, perspective scope, AI dismissal/JSON/VTT, responsive overflow and WebGL failure fallback.
- Python: 48 independent pipeline/claim and legacy regression tests. No automated test calls Azure.

Browser screenshots and captures are review artifacts, not a guarantee of frame rate on every GPU. Low graphics is the default; 2D remains available. No claim of formal hackathon submission follows from a deployment.

An additional 390×844 touch-emulated Chrome review observed 420 frames over approximately seven seconds around the winning shot (59.96 fps mean; 33.4 ms worst frame), with the ball safely inside the projected frustum throughout. A native single-finger canvas swipe scrolled the page 81 px. [Observation](evaluation/broadcast-browser.json). This is a narrow software-renderer observation, not a physical-phone performance claim. CI separately guards native scrolling and trusted two-finger zoom input. Event-derived headlines describe the logged score change; they are UI factual rendering, separate from the agents' cached evidence selection.
