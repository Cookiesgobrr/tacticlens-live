# Protected Live AI test and read-only replay

Issue #40's owner-authorized test completed on **23 October 2026** using the existing Microsoft Foundry GPT-4.1-mini deployment. It covered **only seed 82's winning goal at 78:00**, exact engine timestamp **4680.25**. Three sequential agent calls succeeded; no inference retry occurred. Generation is now disabled. This is a recorded live test, **not continuous generation during replay**.

The public demo still defaults to the original genuine seven-moment Foundry showcase. Its cache, the simulation, all source IDs, and shared 2D/3D timeline are unchanged.

## Inspect the result

1. Open [seed 82](https://cookiesgobrr.github.io/tacticlens-live/?seed=82&tour=off).
2. Expand **Live AI test · read-only preview** and enable **Use verified live-test cache**.
3. Seek to the winning goal (78:00). The preview checks the published record, then shows **Verified · protected live-test result**.
4. Expand **Agent trace, all evidence & broadcast exports**. Inspect the three new provider response IDs, source events and JSON export. Change audience; all perspectives use the same verified record.

Before the event the status is Waiting. A missing, invalid or unreachable record shows Unavailable and retains the existing verified showcase. Turning the option off restores the showcase immediately. A different tracked player receives deterministic fallback rather than another player's AI card. Other seeds never receive SIM-82 evidence.

There is no Generating state: the browser cannot generate. It makes at most **one same-origin static GET per page session**, triggered by opting in at the covered event. There is no polling timer, public Function key, Azure URL or generation POST. GitHub Pages serves exactly `data/live-sim82-4680.25.json`; it adds no Azure infrastructure or visitor-triggered model costs.

## Observed execution

| Agent | Input tokens | Output tokens | Observed agent latency |
| --- | ---: | ---: | ---: |
| Insight | 1,296 | 45 | 1,729 ms |
| Verification | 1,296 | 23 | 1,508 ms |
| Presentation | 1,398 | 76 | 1,527 ms |
| **Total** | **3,990** | **144** | **4,764 ms** |

Server pipeline: **6,218 ms**. Operator request: **7,565 ms**. These are observations from one run, not latency guarantees. The agents select and verify canonical evidence and audience plans; original professional commentary is compiled by the existing audited editorial grammar. This test does not claim unrestricted model-written paragraphs.

The Azure credit counter was checked immediately before and after. Sufficient existing free-trial credit was available; the immediate counter showed no posted change. **Billing can lag: that is not proof of zero inference cost.** No dollar inference cost is asserted without a settled usage record. Account identifiers, balances, credentials and private approval records are excluded from the repository. No subscription upgrade, new resource or role grant was made.

## Protection and verification

- Actual ARM reads verified an enabled **FreeTrial** subscription with **spendingLimit On** and the existing successful GPT-4.1-mini deployment. Billing reads verified active trial credit. Hosted managed identity successfully performed its management-plane preflight and used its existing model and private Blob permissions.
- Only `82/4680.25` was authorized. An operator-provisioned private approval bound the subscription, exact source SHA-256, source engine SHA-256, current credit attestation and ten-minute expiry. No browser-supplied prompts or event text are accepted.
- The reservation in private Blob storage was acquired atomically before model initialization and remains in place. Success, failure or timeout cannot release it for an automatic retry. Failed paid tests require renewed owner authorization.
- Each run permits at most **3 sequential calls**, **1,000 output tokens per call**, **16,000 UTF-8 input bytes per call**, and **0 SDK retries**. These caps are enforced at the real Agent Framework/OpenAI transport boundary. The input-byte cap is not a monetary price cap; Azure trial spending protection and existing credit checks provide the financial protection.
- Independent Python verification recomputes the full 1,871-event source and selected moment, validates statistics, claims, source IDs and audience compositions. Only the current verified moment is sent to agents. The browser independently regenerates seed 82 and verifies the one-card pack, provenance, budgets, timestamps and three distinct completed agent responses before display.
- Goal **SIM-82-01629**, shot **SIM-82-01628**; score **3–2**, **20 shots**, **2.41 combined synthetic xG so far**. Full time remains **22 shots / approximately 2.57 xG**. Full-time values must not be substituted into 78:00 commentary.
- After publication, ARM verified **both live and legacy generation flags false** and an **empty approved-moment list**, at **2026-10-23T15:57:30.165451+00:00**. The public record adds that operator observation to the immutable private server publication; the server record does not assert that it switched itself off.

Source SHA-256: `d67670f7cb63452b24e05dcb88550036386e0dee56592e186c6d45d0306cc52d`.

Engine SHA-256: `961d4746c6996e30d1289583bc114387a002bb5ef0db23328b392056970f5e5d`.

Original showcase SHA-256: `ea1982c5730bd29060ec99416033d636152020e69081487ef8411d1b653d8c1d`.

## Architecture and operator boundaries

`api/live_approval.py` verifies the private approval; `api/live_cost_guard.py` performs actual managed-identity ARM checks; `api/live_moments.py` owns reservations, verification and immutable results. `api/eleven_agents.py` runs Insight, Verification and Presentation through Microsoft Agent Framework and the Foundry Responses API with managed identity.

All three live Function routes require Function authorization:

| Route | Capability |
| --- | --- |
| `GET /api/live-preflight` | Read-only subscription/deployment checks and actual generation flag; no model initialization |
| `GET /api/live-moment/{seed}/{at_second}` | Read and validate the finite approved private cache |
| `POST /api/live-generate/{seed}/{at_second}` | Operator-only, disabled; reservation and all approval checks precede any model call |

The frontend has access to none of these routes. `web/src/liveMomentCache.ts` validates the finite published envelope. `LiveMomentPreview.tsx` fetches only the static file; `FootballMatch2D.tsx` switches display packs while retaining the verified fallback. Both replay renderers continue using the same engine.

**Do not re-enable generation, reset the retained claim, broaden the allowlist or renew the approval without new owner authorization.** The original authorization has been exhausted. No CI job or normal replay calls Azure models. Keep credentials, Function keys, billing records and private source/approval blobs out of public artifacts.

## Reproducible checks without inference

```bash
python -m pytest api/tests -q
cd web
npm ci
npm run test:live
npm run build
npm run test:live-browser
```

SDK transport tests use a local MockTransport, not Azure. CI installs the full existing Python requirements and runs them; a lightweight local environment without the optional SDK skips them. Browser checks cover opt-in, one GET, before-event/rewind/seed/player isolation, JSON parity, mobile overflow, and missing/tampered/network fallback. Existing simulation, camera, commentary, formation, 2D/3D and guided-tour checks remain in CI. Deployment runs read-only browser checks against the actual public site.
