# 11v11 calibration and evidence gates

Run `cd web && npm ci && node --experimental-strip-types scripts/check-match.mjs --write` with Node 22.18+.
Run with `--holdout --write` for independent seeds 1001–1100. JSON files include every seed, not only the summary. No external match data or cloud model requests are used.

## Method

The previous main-branch engine (8bcf9b0), default seed 2927, generated 154 shots, 31 goals and 30.04 xG in 90 minutes. Its three-seed test asserted only a lower bound on chances. This concealed severe inflation.

The revised simulation uses separated defensive, midfield and forward lines relative to the ball in each team's own coordinate system. One defender presses, another covers; attacking lanes keep width and depth. Forward pass preference no longer overwhelms passing-lane pressure. Decision times, dribbling speed and shot selection depend on local state. Rushed kicks alter the physical destination rather than falsifying completion flags. No score-dependent balancing, target goals, scripted shots, retries, seed rejection or post-hoc rescaling exists in the engine.

Shot xG is computed and logged before the outcome is sampled. Formula: `0.39 × exp(-max(0,distance-6)/12) × clamp(cos(angle)^2,0.08,1) × clamp(0.5+nearestDefenderDistance*0.1,0.5,1)`, clamped to [0.005,0.55]. Angle is the off-axis angle from goal center. This is a simplified synthetic probability model, **not fitted to professional football data**. Goals, saves and misses follow the same shot trajectory and cite its event ID. Saves are a simplified keeper interception animation, not a learned keeper model.

Constants were adjusted using seeds 2927, 2027, 110, 989 and 1. Then sequential seeds 1–100 were evaluated, with 1001–1100 as holdout. Kickoff validation exposed and fixed an inherited reset defect; both sets were rerun after that fix. Population tolerances are outside the engine: >=75% of matches with 15–35 combined shots, >=94% with 0–6 goals, >=85% with xG 1–5, mean short-pass completion 75–96%, and aggregate goals within four Bernoulli standard deviations of total pre-outcome xG. These are broad prototype sanity gates, not claims of real-world statistical calibration. Outliers remain in the published results.

## Physical and evidence checks

Every 0.25-second sample is checked for pitch bounds, finite values, ownership, ball/carrier contact, flight phase consistency and player/ball speed bounds. Large repositioning is permitted only at a logged dead-ball restart. Every kickoff must place each team in its own half. Every pass/shot origin must equal its actor's recorded location. Each outcome must cite one earlier action in the same seeded match and can resolve it only once. Goal position must cross the goal line between the posts. Mutation tests break ownership, xG and source IDs to prove the gates fail.

The UI must additionally be inspected in a real browser; invariant tests cannot establish that the match looks convincing. Archived Azure/Foundry evidence is a different dataset and is never used to explain these new events.

## Known simplifications

No offsides, fouls, cards, fatigue, substitutions, throw-ins, corners or half-time change of ends. The pitch clock runs continuously through short restart pauses. Misses restart with a goal kick. Passes are intentionally limited to short/medium outlets (up to 26 m before kick error), so completion rates are higher than all-pass professional benchmarks. Players have no licensed or real-world performance attributes.

## Results after kickoff correction

| Metric | Seeds 1–100 | Holdout 1001–1100 |
| --- | --- | --- |
| Shots: mean / 5th–95th percentile | 23.34 / 16–31 | 22.67 / 15–29 |
| Goals: mean / maximum | 2.07 / 7 | 1.99 / 6 |
| Total xG: mean / 5th–95th percentile | 2.128 / 1.356–2.937 | 2.087 / 1.196–3.071 |
| Short-pass completion: mean | 93.56% | 93.58% |
| Within 15–35 shots | 100% | 94% |
| Within 0–6 goals | 99% | 100% |
| Within total xG 1–5 | 100% | 98% |

One seven-goal outlier remains in the calibration set. The holdout shot range is 10–38: neither tail is suppressed. The default seed 2927 ends 0–0 on 2.06 total xG; the prototype does not force a goal for presentation.


## Versioned formation evaluation

The published classic 100+100 populations above remain unchanged. The public UI now uses `formations-v2` for other seeds; seed 82 is always routed to its exact classic engine. A separate, predeclared 100-match population (1–50 and 1001–1050) covers all five formation shapes with motion, ownership, event-source and determinism gates. Means: **19.37 shots, 2.13 goals, 2.23695 xG**. [Every row](formations-v2.json) is retained. These are simplified simulation checks, not a real-football validation benchmark. See [version and replay contracts](../BROADCAST_EXPERIENCE.md).
