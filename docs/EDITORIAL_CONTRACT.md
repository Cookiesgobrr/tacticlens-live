# Original football coverage and formation evidence

Issue #36 uses the explicitly permitted **richer constrained editorial grammar** path. The existing three genuine Foundry executions remain the evidence plan. This release makes **zero new model calls**, changes no Azure resource, and leaves the published cache and complete seed 82 simulation untouched. It does not claim that GPT wrote these new paragraphs or analysed the newly sampled positions.

## Architecture and verification

`momentIntelligence.ts` first regenerates the cache's facts from the authoritative 11v11 engine. `editorialCommentary.ts` then compiles original audience-specific coverage from the actual Insight selections and Presentation focus. Each editorial line declares its canonical claim families, actual `SIM-82` evidence IDs and, where applicable, roster IDs. Derived story statements use the prefix-only score history: the deficit, unanswered goals, scorer share and interval between goals. No crowd reactions, assists, intentions, fouls or tactical causes are invented.

The independent Python source verifier recalculates score, attempts, xG, chronology, source-shot geometry, player identity and possession sequences. The English contract is **exact regeneration**, not a regex for numbers and not an LLM approving itself. Altered prose, sources, roles, perspective, totals or timestamps fail the compiler gate. The existing separate Foundry Verification agent remains an additional veto; its approval cannot bypass code verification.

| Perspective | Editorial treatment |
| --- | --- |
| Fan | Original live-text coverage: the goal, changing stakes, comeback and scorer's contribution; 2–5 meaningful sentences, without invented atmosphere |
| Analyst | Chance distance/angle/nearest defender and synthetic xG; recorded passing sequence; adjacent ten-minute shot windows; qualified interpretation |
| Northport supporter | The recovery from a deficit, the team's attempts and scoring contribution |
| Southbridge supporter | The erosion of the lead, their team's output and the final result; no prediction of events still to come |
| Player | The selected scorer's actual listed role, attempts, goals, receipt and source shot; another selected player cannot inherit that card |
| Broadcast | A concise score-and-scorer caption rather than the entire analysis paragraph |

At 78:00 the Fan edition reads:

> 78:00 — Northport are ahead! S. Grant puts Northport in front, Northport FC 3–2 Southbridge Athletic. Northport were two goals down; three unanswered goals have turned it into a lead. The equaliser came at 76:25; 95 seconds later, the scoreboard has turned again. S. Grant has supplied all three Northport goals, this latest finish coming from 12.2 metres.

The goal is `SIM-82-01629`, its source shot is `SIM-82-01628`, and the earlier equaliser is `SIM-82-01597`. All three already exist in the original timeline. A lead change is not labelled a win until full time. At 78:00 the match has 20 attempts, not the final 22. No card appears before its event; cards expire after 120 match seconds. JSON exports reproduce the selected displayed text and sentence evidence. VTT uses the deliberately shorter Broadcast edition and ends no later than the current replay time.

## Team formations

Both seed 82 teams genuinely use **4-3-3** throughout. No formation change is inferred from a goal. Other seeds retain their existing formation-v2 selections across all five templates.

`formationIntelligence.ts` describes the actual template roles and anchors, defensive and midfield lines, width, forward lanes and support. It separately samples the preceding five minutes at five-second intervals, excluding stoppages and never sampling after the replay boundary:

- Outfield width is the lateral range of ten outfield players.
- Defensive depth is the mean back-line distance from the team's own goal line.
- Midfield gap is mean midfield depth minus mean defensive depth.
- With-ball and without-ball depths use the sampled ball owner's actual team; unowned samples contribute to neither split.
- Nearby support counts other outfield teammates 4–26 metres from the carrier, the engine's candidate-pass range. This does not establish an open passing lane.
- Completed passes, logged ball wins, shots and synthetic xG come from the same bounded event window. Replay buttons expose representative source actions.

At 78:00 Northport's five-minute window contains 56 active samples, 43.3 metres of mean outfield width, a 31.6-metre defensive depth and a 12.1-metre midfield gap. There are 14 completed passes. Python independently recomputes these values from raw sampled positions; Node also compares every raw sample to the authoritative engine. This catches changes that leave aggregate metrics unchanged, such as a goalkeeper-only position edit.

The marked **Microsoft Foundry match context** uses the genuine Insight-selected team, shot-activity and passing-sequence evidence. Dedicated formation editorial grammar connects that evidence to the displayed shape without claiming the formation caused the outcome. Newly measured spacing and nominal tactical descriptions are **deterministic**, not fresh model-written tactical reports. Other seeds and pre-event views show no SIM-82 Foundry context. Formation exports include the exact measurement boundary, sampled timestamps, anchors, source IDs and contextual claim links.

## Presentation and provenance

The five requested UI removals are implemented: the visible agent-path strip, “Football, explained.”, the “Simulated football ·” prefix, the successful 22-player validation sentence, and the old showcase-engine formation footer. Validation failures remain visible. Fictional data, simulated tracking, synthetic xG, cached model execution and authored grammar disclosures are retained in expandable About/audit panels. Agent trace remains accessible, with its original response IDs. The football renderer, engine and event timeline are shared and unchanged.

## Reproduce without inference

```sh
python -m pytest api/tests -q
cd web
npm ci
npm run test:editorial
npm run test:intelligence
npm run test:formations
npm run test:browser
npm run build
```

`export-editorial-review.mjs` produces the 42 commentary editions, 14 formation boundaries, formation prose and raw samples for independent Python/Node checks. CI runs these checks without Azure credentials. `api.precompute_eleven` now checks both existing and pending output paths **before** credentials or paid calls, and applies the new independent editorial/position gates before publishing a future explicitly authorised batch. Publication is exclusive and atomic. Existing free-trial, spending-limit, call-cap, token-cap, reservation and no-retry protections remain intact. Running its confirmation flag is an operator action, not permission inferred from developing this UI.
