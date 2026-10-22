# Archived Foundry setup

For the completed new-match integration, use [FOUNDRY_11V11.md](FOUNDRY_11V11.md). The commands below describe the older dataset and must not be used to generate SIM-82 evidence.

# TacticLens Live: Microsoft Foundry integration

The existing public GitHub Pages dashboard remains a **static synthetic preview** and does **not** call Foundry. The existing `/api/agent-demo` endpoint remains deterministic.

The actual cloud adapter contains **three distinct Microsoft Agent Framework agents**: Insight, Verification, and Presentation. Each runs against one Foundry model deployment. The existing code-only Evidence Gate independently verifies source event IDs and counts before the model verifier runs. Presentation is checked for unsupported numbers; failures fall back to deterministic text or fail closed.

## Confirmed Foundry deployment

Your Foundry "Continue in code" screen shows an OpenAI-compatible Responses endpoint and deployment:
- Resource endpoint: `https://tarunjacob2927-8313-resource.services.ai.azure.com/openai/v1`
- Deployment name: `gpt-4.1-mini`
- Authentication: Microsoft Entra ID, via a local Azure CLI sign-in; **no API key is needed in code**.

The resource URL above is a public service endpoint, not a secret. Do **not** copy your API key from Foundry or store it in GitHub.

## Run when ready (one intentionally billable test)

From the repository root on your Mac:

```bash
git switch main && git pull origin main
source .venv/bin/activate
python -m pip install -r api/requirements-foundry.txt
az login
export FOUNDRY_OPENAI_BASE_URL="https://tarunjacob2927-8313-resource.services.ai.azure.com/openai/v1"
export FOUNDRY_MODEL="gpt-4.1-mini"
python -m api.run_foundry --at 4500 --confirm-cloud-cost
```

Do not run the final command until you're comfortable using a small amount of Azure trial credit. The CLI requires `--confirm-cloud-cost` and deliberately does not expose inference via an unauthenticated HTTP route. Running it once uses up to three model invocations and may incur small trial-credit charges.

If you use a Foundry **project** endpoint instead, set only `FOUNDRY_PROJECT_ENDPOINT`; unset `FOUNDRY_OPENAI_BASE_URL`.

Use `python -m pytest api/tests -q` to run offline tests with no API calls. The cloud integration has **not** been proven to work end-to-end until the explicit CLI test succeeds. If that test returns `status: error`, do not assume success; investigate Azure permissions and SDK compatibility.

Microsoft Agent Framework guidance: https://learn.microsoft.com/en-us/agent-framework/agents/providers/openai

