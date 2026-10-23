# Private Live AI — stage-one implementation

TacticLens now has a **private, event-triggered, one-moment-at-a-time Foundry generator**. It is **not activated** in the public GitHub Pages experience. No Azure requests are made in tests or in normal replay.

## What is implemented

- `api/live_moments.py`: accepts only integer seed + approved event timestamp, never a user prompt or arbitrary match events. Source snapshots must be provisioned separately to private Blob storage.
- `api/eleven_pipeline.py`: independently verifies the full source, then restricts the three-agent pipeline to the single current moment. Agents see no future moments. The canonical claim list remains the only factual vocabulary they can select.
- `function_app.py`: Function-auth protected `POST /api/live-generate/{seed}/{at_second}` and read-only `GET /api/live-moment/{seed}/{at_second}`. **Both require Function authorization**; no keys are embedded in the public frontend.
- Durable Blob reservations `live/claims/{seed}/{second}.json` before opening agents. A failed or timed-out call never automatically retries.
- Immutable per-moment result cache `live/results/{seed}/{second}.json`. All views of a cached moment incur zero new Foundry inference charges.
- Private approved source `live/sources/{seed}.json`. Seed 82 can be exported with `node --experimental-strip-types web/scripts/export-ai-source.mjs`. **Do not make source blobs publicly writable.**
- Disabled by default (`TACTICLENS_LIVE_AI_ENABLED` must be explicitly `true`), no arbitrary free-text input, no public generation routes, no trial upgrades or new resources.

## Crucial limitations — activation NOT complete

This stage deliberately does **not** turn on live Foundry calls. In particular:

1. The current `ElevenFoundryBackend` obtains an **Azure CLI credential**. An Azure Function with only Managed Identity does *not* have an Azure CLI login. To deploy live, adapt this operator agent client to a managed-identity bearer token provider with the appropriate least-privilege role and test in the target Azure environment.
2. The current `trial_preflight()` relies on the Azure CLI and must be replaced by an authorized cloud-side equivalent that queries the real Azure subscription policy and confirms the spending limit is On **on each request**. Otherwise the endpoint remains fail-closed (503 or 409), as intended.
3. A private Blob container and `TACTICLENS_STORAGE_BLOB_URL` already support legacy publishing, but permissions and its configured presence must be verified. The operator must upload source snapshots through a protected channel after an independent match-generation check. Source snapshots cannot be submitted by anonymous clients.
4. The browser intentionally **does not poll this Function-auth endpoint**. A public cache gateway will need a separate read-only, rate-limited service or static object publishing, with no function key or identity token in bundled JavaScript. Generate only on explicit operator/session authorization, not every page visit.
5. The production `validateAIPack` browser contract currently expects seed 82's seven-moment full-match cache. Supporting a single-moment pack and other seeds requires a versioned validator and safe merge with the existing precomputed cards. A one-card live pack must not be labelled verified in the public app before this work.
6. No free-trial availability, billable inference budget, role assignment, Azure configuration or runtime costs have been verified in this PR.

**Do not set `TACTICLENS_LIVE_AI_ENABLED=true` or publish public inference until all the conditions above are satisfied.**

## Tests, without any cloud charges

```bash
python -m pytest api/tests/test_live_moments.py api/tests/test_eleven_pipeline.py -q
python -m pytest api/tests -q
cd web && npm ci && npm run build
```

These tests use a fake three-agent backend and intentionally simulate provider failure and preflight rejection. They do not prove live Azure interoperability or true end-to-end response time.

## Recommended second stage before activating the feature

- Provision or reuse **approved** operator-only storage and managed identity with spending-limit checks. Explicit user approval is required for any paid operations.
- Add `Live AI (private preview)` toggle available only under authenticated operator session; provide a clear 'Connecting/Verifying/Ready/Unavailable' status, with fallback to existing seed 82 cache and deterministic commentary.
- Implement an authenticated operator trigger and publicly readable but **non-generating** view cache for verified results; no public visitor may trigger an agent call or cause trial-credit depletion.
- Add rate/token budgets enforced server-side, replay-time bounds, concurrency tests, source-code hash match for each approved seed, cache tamper rejection, 2D/3D smoke tests and a controllable kill switch.
- Validate latency and output quality with a **single explicitly authorized** model invocation, check the resource invoices/credit status, and only then consider expanding seed support.

The original seed 82 3–2 showdown and seven verified precomputed cards remain the public judge demonstration. No changes to match physics or its original source IDs.
