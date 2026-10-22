# Replay-time evidence and broadcast captions

The match studio's “Export evidence JSON” and “Export broadcast VTT” buttons export only the selected replay prefix. Exporting at 45:00 cannot reveal a later goal. These client-side downloads make no model or server requests.

## JSON contract

`schemaVersion: tacticlens.evidence.v1` includes:

- `matchId`, `seed`, `asOfSecond` and the audience/team/player view.
- Explicit provenance: deterministic synthetic 11v11, rule-based narrative, simplified xG, no real-world calibration and no Foundry evidence.
- `totals` computed from source events at or before `asOfSecond`.
- `recap` with cited stable event IDs and the exact visible event prefix in `events`.
- `cues`: start/end seconds, caption text and the source shot/outcome IDs.

`auditEvidenceReport(match, unknownReport)` reconstructs this deterministic report against the provided match and rejects mismatches in identity, time, view, schema, provenance, totals, recap, cues or events. It accepts a JSON round trip. This is an integrity gate for this format, **not** a general-purpose validator of LLM prose or cryptographic authentication. It does not establish the truth of real-world data.

A future Foundry adapter must use the new match's event IDs, deterministic numerical totals and an independently reviewed claim-validation contract. This export does not enable that adapter or reuse archived evidence.

## WebVTT

Captions use the match clock (`HH:MM:SS.mmm`), not accelerated recording time. Set the video playback speed appropriately when using them. Each shot/goal/save/miss cue ends at the next decisive action, after six seconds, or at the export boundary—whichever occurs first. At the exact start instant of a cue there is no positive duration to export yet. Empty prefixes produce a valid header with no cues.

Shot captions contain pre-outcome xG only. A later outcome replaces that cue only after the outcome event occurs. IDs are included as a second caption line; the JSON is the richer machine-readable contract. Caption text is escaped for WebVTT.

## Evaluation

`npm run test:evidence` checks all audience views at kickoff, immediately before/at/after the first shot and outcome, half time and full time. Mutation tests add a goal to the totals, fabricate a probability claim, inject a future event, replace an event ID with an archived ID, claim Foundry provenance, and substitute another seeded match. All must fail closed. Browser CI downloads both files and verifies the actual downloaded contents, including a rewind before the first shot.
