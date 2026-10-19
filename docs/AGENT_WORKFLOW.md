# Evidence-aware multi-stage orchestration

**Current status: Offline deterministic orchestration. Not yet LLM-powered and not yet Microsoft Foundry.**

`api/agent_pipeline.py` introduces three separately injectable stages (Insight, Verification and Presentation), a non-negotiable deterministic evidence gate, output number checks, explicit stage trace and fail-closed error handling.

The demo backend reuses the existing seeded synthetic match and its independently calculated 10-minute high-recovery signal. The viewer only receives narratives after the source count and complete evidence ID sets are checked. A presenting stage that fabricates numerical claims triggers a labelled rule-based fallback. A failed evidence gate or reviewer suppresses the candidate.

## Try locally

From the repository root (with `.venv` activated):

```bash
python -m pytest api/tests -q
python -m uvicorn api.main:app --reload --port 8000
```

Visit `http://127.0.0.1:8000/api/agent-demo?at=4500`.

The JSON includes `provider: offline-demo` and `trace`. Before 75:00, it returns `status: waiting`.

## Microsoft integration next

Use this `Backend` protocol as the boundary for an Azure Foundry / Microsoft Agent Framework implementation after cloud credits, model quota, and correct SDK version are established. Create separately instructed model agents for proposing, verifying and presenting. Keep evidence_gate and numeric validation outside LLMs. Record model/version, token counts, latency, and failure modes.

Do not describe this deterministic demo as an operational Foundry multi-agent system. Do not expose a publicly callable, billable model endpoint without authentication, rate limiting and spending controls.
