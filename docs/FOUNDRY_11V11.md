# Verified Foundry intelligence for the 11v11 match

## What actually ran

The primary showcase is **SIM-82**, a natural 3–2 Northport comeback from 0–2. Seven moments—five goals, halftime and fulltime—were precomputed with the existing Azure Foundry deployment **GPT-4.1-mini, model version 2025-04-14**. Three distinct Microsoft Agent Framework `Agent` instances made three successful Responses API calls:

| Agent | Input tokens | Output tokens | Duration |
| --- | ---: | ---: | ---: |
| TacticLens11Insight | 6,626 | 270 | 4.678 s |
| TacticLens11Verification | 6,851 | 68 | 2.001 s |
| TacticLens11Presentation | 6,953 | 528 | 6.983 s |

Total: **21,296 tokens**, not an estimated dollar charge. The complete response IDs, decisions, source hash and cost-protection state are in [the execution audit](evaluation/foundry-sim82-audit.json). The [public result](../web/public/data/foundry-sim82.json) contains the verified cards and agent trace. These are actual model outputs, not test fixtures. An initial Azure JSON-mode request was rejected with HTTP 400 before inference; its input formatting was corrected explicitly. Automatic SDK retries were disabled throughout.

## What the AI does, and what code does

The **Insight agent** selects evidence and an editorial focus for each moment. The **Verification agent**, with separate instructions, independently reviews the selections against the canonical facts. The **Presentation agent** composes distinct Fan, Analyst, Northport supporter, Southbridge supporter, Player and Broadcast views by selecting and ordering approved claims.

This is **constrained AI editorial generation**. Models do not invent statistics or supply unrestricted prose to the viewer. Factual sentences are rendered verbatim from code-generated claims. The model chooses relevance, ordering and perspective; code owns numerical truth and factual wording. Do not describe these sentences as unrestricted LLM-authored commentary, the agents as three different models, or the pipeline as a hosted autonomous Foundry Agent Service. The three client-side Agent Framework agents use one existing Foundry model deployment in a sequential workflow.

This restriction deliberately makes the final claim gate stronger than a numeric regex or an LLM saying its own text is correct. It also limits linguistic variety. Shot activity is an observable change in attempts, not a measurement of pressing, psychological momentum or tactical causation. A logged passing sequence before a goal does not establish why the goal happened.

## Data and gates

1. The production TypeScript engine exports the actual seed 82 event log and seven prefix-only moment fact tables. There is no second simulation and no conversion from archived `EVT-` events.
2. A Node gate regenerates every event, player, factual sentence and moment from the production engine and requires exact equality before cloud use.
3. Python independently recalculates score, shots, team xG, recent/previous ten-minute shot counts, scoring runs, player contributions and uninterrupted buildup sequences. It verifies chronological IDs, actors, coordinates, source-shot lineage, shot geometry and the pre-outcome xG formula.
4. Model proposals may reference only canonical claim IDs available at that moment. The separate model reviewer can veto publication; it cannot override code checks.
5. Model presentation may only select approved claims for six explicit audiences. Unsupported claims, duplicate IDs, wrong moments and identical Fan/Analyst compositions are rejected.
6. Before publication, the browser-equivalent validator regenerates all card facts from `generateMatch(82)`. The same validator runs on the public response when the application loads it.
7. During replay, a card appears only from its `atSecond` until 120 seconds later. Uncovered replay times use the live deterministic fallback. Player views additionally require the card's actual player. Other seeds, unavailable/invalid caches and unmatched player/time combinations use clearly labelled deterministic insights.

The cache is ordinary public repository content, not cryptographically attested AI provenance. The checked-in execution audit and provider response IDs support reproducibility and inspection. Changing the engine or canonical factual sentences invalidates the cache rather than silently reassigning its evidence.

## Safe public serving

GitHub Pages serves static JSON. Visiting the site, seeking, selecting a perspective and exporting captions make **zero model calls**. No Azure key, bearer token or public inference endpoint is included. The archived six-a-side demonstration remains a separate view and dataset. Its existing Azure endpoints are not used for the new match.

The operator runner requires an enabled **FreeTrial** subscription with **spendingLimit On**, the existing GPT-4.1-mini deployment, explicit trial-credit confirmation and an Azure CLI sign-in. It provisions nothing. One durable local claim is created before inference; failures retain the claim. Each batch is limited to three calls, 160,000 input characters per call, 6,000 output tokens per call, 60-second HTTP timeouts and zero automatic retries. It refuses to overwrite an existing publication. Inspect failures before deliberately reserving another batch; do not run this command casually on every edit.

## Reproduce without spending credits

```sh
node --experimental-strip-types web/scripts/export-ai-source.mjs artifacts/sim82-source.json
node --experimental-strip-types web/scripts/check-ai-source.mjs artifacts/sim82-source.json
python -m pytest api/tests -q
cd web
npm ci
npm run test:intelligence
npm run build
npm run test:browser
```

CI uses fakes only in named unit tests. It validates the genuine checked-in cache and never invokes Azure. The 200-seed simulation population gates remain separate from the AI claim tests.

## Operator-only regeneration

The final command consumes trial credits. Do not run it unless a new batch is necessary and the subscription still meets the runner's protection checks.

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r api/requirements-foundry.txt
az login
node --experimental-strip-types web/scripts/export-ai-source.mjs artifacts/sim82-source.json
python -m api.precompute_eleven --confirm-trial-credits
```

If a publication or `artifacts/foundry-sim82.claimed` already exists, stop and review it; the runner intentionally does not reset reservations or replace published output automatically. If credentials, credits or the spending limit cannot be verified, keep the existing static cache and do not upgrade Azure.

Pinned successful runtime: Python 3.14; Agent Framework Core 1.22.0, OpenAI provider 1.17.0, Azure Identity 1.26.0 and OpenAI Python 3.36.1. No API keys are required; Azure CLI credentials are used only by the local operator.

## Primary references

- [Microsoft Agent Framework OpenAI/Azure routing](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/model-providers/openai)
- [Agent execution and run options](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/running-agents)
- [Azure spending-limit behavior and exclusions](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit)
