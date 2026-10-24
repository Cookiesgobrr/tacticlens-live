# Event-driven multi-moment sessions — disabled private preview

This adds a new session service alongside the untouched seed 82 showcase and October 23 winner publication. **No new Azure inference has been authorized or executed.** Passing mocked tests does not establish continuous live Foundry generation. Public Pages remains cache-only until an explicitly approved session backend is deployed, configured and demonstrated.

## Implementation

The existing deterministic engine exports an operator-only `tacticlens.session-source.v1` snapshot (`web/scripts/export-session-source.mjs`). It supports classic-v1 seed 82 and formation-v2 seeds, preserving their correct SIM identifiers. The source includes engine/formation code SHA-256. An operator must regenerate it from the approved commit, validate it and provision it privately; a new owner approval pins the complete canonical source hash and engine hash. Browsers cannot submit events, prompts, source snapshots, seeds or match timestamps.

A protected Azure timer advances a server-owned session clock and evaluates actual event prefixes. It detects goals, high-quality resolved chances/saves, defensive interventions near the defending goal, completed passing sequences, measured shot-activity changes, individual action thresholds and halftime/fulltime. Eligibility is broader than publication: significance, cooldowns, bounded queue, staleness and paced minor-event budgets decide what merits inference. No ordinary-pass model calls and no preset-minute AI cards. Halftime/fulltime are explicit lifecycle events. Positional reorganization and territorial-control interpretations are deliberately excluded because this contract does not contain measured tracking windows.

A single ETag compare-and-swap Blob ledger atomically owns sessions, event deduplication, bounded queues, workflow slots, daily counters and worst-case call/token/cost reservations. All viewers share a session; refresh, replay, audience changes and GET polling never enqueue work. One session per approval prevents restart-based quota resets. Multiple approved sessions share the same global ledger. A workflow reserves three calls, three maximum inputs/outputs and its conservative operator-priced allocation before backend initialization. Reservations are never refunded automatically, including failures, timeouts and malformed output. Queued stale work may be discarded; a submitted request is never represented as canceled or free.

`SessionFoundryBackend` uses the installed Microsoft Agent Framework and existing Foundry GPT-4.1-mini deployment with managed identity, three ordered agents, zero SDK retries, bounded input bytes/tokens, and bounded output tokens. Each attempt is durably recorded before transport. Insight selects an editorial angle and canonical claims. Verification independently audits those choices. Presentation composes six differentiated claim orders. Code recalculates the canonical prefix before publication, rejects extra/free-text fields, and validates score, seed, actors, event IDs, xG and attribution. The browser independently regenerates the same candidate/facts and rejects tampering. Coordinates and shot measurements use an explicit six-decimal publication precision to avoid insignificant Math/libm differences across Node, Chrome and CPUs; original source geometry is validated before rounding.

**Commentary is constrained editorial composition, not unrestricted model-authored paragraphs.** The model selects evidence and audience ordering; original audited grammar renders Fan, Analyst, both supporter, Player and Broadcast editions, each with source IDs. A numeric regex or model self-review is not treated as proof of arbitrary prose. A selected player's view cannot borrow another player's analysis.

The optional AI Moments reader shows factual identification, actual processing/verification states, verified cached history, sources and replay. A slow response never pauses the simulation. A late card remains at its original timestamp in history. Join live clock explicitly synchronizes local playback with the server; subsequent replay controls remain independent and cannot alter the server clock. Rewinds hide future records. Both existing renderers continue sharing the untouched engine. Ordinary visitors never receive Function keys or model credentials.

## Limits and enablement

All new routes and timer are dormant unless `TACTICLENS_SESSION_AI_ENABLED=true`; unset defaults OFF. The legacy flags and exhausted Issue #40 approval do not activate this system.

| Configuration | Meaning |
| --- | --- |
| `TACTICLENS_SESSION_APPROVAL_IDS` | Explicit finite new owner-approved private approval IDs |
| `TACTICLENS_SESSION_GLOBAL_LIMITS` | Required JSON: calls, inputTokens, outputTokens, microUsd per UTC day; activeSessions; concurrency |
| `TACTICLENS_SESSION_PUBLIC_IDS` | Separate finite read-only exposure allowlist; default empty |
| `VITE_LIVE_SESSION_READ_ORIGIN` | Optional build-time HTTPS backend origin, no credentials/path/query |
| `?session=APPROVAL_ID` | Selects an existing readable session; never starts generation |

Code ceilings are 15 moments/45 calls per approved match, 16,000 conservatively bounded input tokens and 1,000 output tokens per call, 12,000 user-input bytes, at most two concurrent workflows and two active sessions. Operators must approve lower explicit operating limits; these ceilings are not authorization. Daily caps apply across all sessions through one ledger. Minor events use at most seven slots at the 15-moment ceiling, leaving goal/lifecycle capacity. Actual event counts vary; there is no minimum quota to fill. The offline seed 82 fixture produces 14 moments/42 **mock** calls, including all five original goals and both lifecycle summaries.

New private approval schema: `tacticlens.session-approval.v1`, `id`, `ownerApproved`, `subscriptionId`, `subscriptionType=FreeTrial`, `spendingLimit=On`, `creditsCheckedAt` (Unix seconds), `expiresAt`, `remainingCreditMicroUsd`, `seed`, `sourceId`, `sourceSha256`, `engineSha256`, operator-verified conservative `inputRateMicroUsdPerMillion`/`outputRateMicroUsdPerMillion`, and exact `limits` fields: `moments`, `calls`, `inputTokensPerCall`, `outputTokensPerCall`, `inputBytesPerCall`, `microUsd`, `speed`. Never commit real approvals, account balances or keys. Test-only prices/credits are synthetic and are not current Azure prices or billing evidence.

Credit attestation must be at most ten minutes old; fresh managed-identity ARM reads require an enabled FreeTrial, spending limit On and the existing successful model deployment before each workflow. Expired/missing approval, unavailable ARM, missing global limits or inadequate allocation fail closed. An approval expires within two hours; a genuine 90-minute session would need an operator-reviewed fresh credit attestation. The initial bounded demonstration can use explicitly approved accelerated playback (at most 60×).

| Route | Auth/capability |
| --- | --- |
| POST `/api/session-start/{approval_id}` | Function key; opens only a newly approved session |
| POST `/api/session-stop/{session_id}` | Function key; drops queued work, retains paid reservations |
| GET `/api/session-feed/{session_id}` | Read-only finite allowlist, two-second cache; no inference |
| Five-second coordinator timer | Disabled by default; source and clock are server-owned |

Public read exposure still requires explicit origin/CORS and CDN/rate-limit configuration on the existing infrastructure. **No public live-generation service is activated by this change.** ARM preflight does not by itself read live billing credit; private fresh credit attestation remains required. Actual billing can lag. Cost reservations use operator-verified price ceilings plus Azure trial spending protection; no claim of zero inference cost is made.

An in-flight timeout/crash retains its reservation. A crash may retain a concurrency slot, deliberately failing closed; an operator must reconcile provider usage and obtain renewed authorization before any retry or budget release. There is no automated failed-call retry or credit refund. Workflow stages stop at a UTC-day boundary rather than submitting against a different day's allocation. Ledger history is bounded at 128 sessions; operator archival is required before more sessions.

## Validation and next genuine test

Tests explicitly label mock traces `offline-mock`. Python/JavaScript parity covers candidates and full prefix facts; population checks cover 100 seeds. Tests include concurrent duplicate workers, kill switch between stages, retained failed reservations, source/seed/actor/score mutations, unapproved sources, model veto/free-text rejection, missing Azure, global/session caps and cache-only readers. Real Agent Framework/OpenAI requests are checked with local MockTransport, never Azure. An offline browser harness drives two different events through the real coordinator/verification/HTTP reader/React history and verifies six **mock** calls total after audience changes, replay and refresh.

Before any real multi-moment test: inspect current subscription policy, settled/remaining trial credit, deployment, managed identity/Blob permissions and existing hosting plan; calculate a conservative total at verified price ceilings; obtain explicit owner approval for a named seed/session and a finite moment/call/token/allocation budget. Provision the immutable source and fresh private approval, deploy to the existing app only, and activate only that bounded session. Demonstrate at least two fresh event-triggered workflows, actual three-agent response IDs, actual tokens/latency, independent verification, running-match UI delivery, cached audience/replay reuse and before/after credit evidence. Disable generation immediately afterward. Do not claim fully live operation until that demonstration succeeds.

The public seven-moment cache, live winner-test publication, engine source, formations, goal timestamps and source IDs are unchanged. If the private service is unavailable, submit the existing stable showcase.


## October 24 bounded rollout authorization

The owner authorized the Azure rollout and additional inference on October 24, conditional on preserving free-trial credit and avoiding personal charges. This is separate from the exhausted Issue #40 test. The initial operating allocation is one seed 82 session (`live-20261024-82`), at most 15 moments / 45 calls, 720,000 input tokens / 45,000 output tokens, one active workflow and a conservative $1 reservation ceiling. Code requires at least $190 of attested trial credit to remain after the entire approved allocation. ARM must still confirm FreeTrial and spendingLimit On. No subscription upgrade, new persistent resource or role grant is part of this rollout.

The website's compiled configuration contains only the existing backend's read-only origin and finite session identifier, never credentials or generation permissions. Azure public exposure remains a finite read allowlist. Generation and the coordinator timer are disabled after the approved session; the verified session history can remain available without further inference. This deployment configuration is not evidence that a real workflow succeeded: actual traces and usage must be inspected before reporting a live demonstration.
