# Optional Microsoft Foundry integration

This code provides three separate **real Microsoft Agent Framework** agents, backed by the Foundry Responses model API, with distinct prompts and sequential handoffs:

- Insight: draft a structured synthetic-football claim.
- Verification: independently evaluate the claim.
- Presentation: write fan, analyst and broadcast copy.

The deterministic evidence gate in api/agent_pipeline.py independently verifies source event IDs and numeric counts before a verification or presentation stage runs. A failure suppresses unverified insights; fabricated output numbers trigger a deterministic fallback.

## Current status

The integration code is implemented with injectable fake agents and can be tested for free. **Cloud inference has NOT been executed, and the application is NOT deployed on Azure.** The live web dashboard and /api/agent-demo continue to use the free offline implementation.

## Only after confirming your free credits, permissions and spending limits

1. Create or obtain a Foundry project and deploy an allowed model.
2. Install Azure CLI and log in: az login.
3. In your Python virtual environment install: pip install -r api/requirements-foundry.txt.
4. Export your own project details in your terminal (never commit secrets):
   export FOUNDRY_PROJECT_ENDPOINT="your-project-endpoint"
   export FOUNDRY_MODEL="your-model-deployment-name"
5. Invoke cloud inference **only deliberately**:
   python -m api.run_foundry --at 4500

Use the full project endpoint supplied by Foundry. This CLI may incur inference charges. We have deliberately not exposed it as a public unauthenticated HTTP route. Revisit authentication, quotas and spending caps before deploying a service that invokes models automatically.

## Testing without Azure

    python -m pytest api/tests -q

The tests use in-memory fake agents implementing the actual Agent.run(message) interface and require no credentials.

### Documentation

https://learn.microsoft.com/en-us/agent-framework/get-started/your-first-agent?pivots=programming-language-python
