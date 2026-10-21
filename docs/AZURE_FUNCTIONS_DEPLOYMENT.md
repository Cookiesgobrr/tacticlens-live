# Azure cloud backend: one-shot verified AI publication

This adds an Azure Functions Python v2 application. It does **not** deploy
cloud resources automatically. The existing GitHub Pages demo remains intact
and does not trigger Foundry inference.

## Cloud design

- `GET /api/verified` reads a previously published, audited Foundry result
  from Azure Blob Storage. It makes **zero model calls**.
- `POST /api/generate` is protected with Azure Functions function-key
  authentication, accepts no custom prompt, and is disabled by default.
- One durable blob claim is written **before** any model invocation. This
  caps the feature to **one attempt** even across retries and multiple workers,
  assuming the storage container provides its normal atomic create semantics.
- A failed attempt deliberately leaves the claim. An operator has to
  manually investigate and reset it. This avoids surprise bills.
- A successful pipeline runs the already-tested Insight, Evidence Gate,
  Verification and Presentation stages, and publishes the result only when
  its status is `verified`. No API key is committed.

## Azure setup requirements (manual, not completed yet)

1. Verify your Azure free-trial balance, service availability and whether
   Azure Functions, storage and model inference are covered. Metered Azure
   services **can consume trial credits**. No pay-as-you-go upgrade is needed
   just to prepare code.
2. Create a Python 3.12 Azure Function App on an eligible Consumption plan
   and a Storage Account; choose regions supported by your subscription.
3. Enable the Function App's **system-assigned managed identity**.
4. Give that identity the minimum required **Storage Blob Data Contributor**
   role scoped to the dedicated container/account as appropriate. Create the
   `tacticlens-verification` container yourself; the app does not grant access.
5. Give the Function's managed identity the **Cognitive Services OpenAI User**
   (or the required equivalent data-plane inference role for your specific
   Foundry resource) on the model resource.
6. Configure application settings in the Azure portal **without committing
   secrets**:
   - `TACTICLENS_STORAGE_BLOB_URL=https://<storage>.blob.core.windows.net`
   - `TACTICLENS_STORAGE_CONTAINER=tacticlens-verification`
   - `TACTICLENS_AI_GENERATION_ENABLED=false` (keep this false initially)
   - `FOUNDRY_OPENAI_BASE_URL=https://tarunjacob2927-8313-resource.services.ai.azure.com/openai/v1`
   - `FOUNDRY_MODEL=gpt-4.1-mini`
7. Deploy code using Azure Functions Core Tools or a restricted GitHub
   Actions identity-based deployment workflow. **Do not put publish profiles,
   function keys or model keys in a public repository.**
8. Verify that `GET /api/verified` returns `pending`, with no model calls.
9. Only with explicit operator approval and confirmed spending limits:
   temporarily set `TACTICLENS_AI_GENERATION_ENABLED=true`, invoke the
   **function-key protected** POST exactly once from a trusted terminal,
   and immediately turn generation off again.
10. Confirm the public cache returns a verified result and that the source
    event IDs match the static synthetic match snapshot.

**Before connecting the public React app:** allow CORS exclusively from
`https://cookiesgobrr.github.io` in the Function App CORS settings.
Do not enable broad origins; do not expose the generation key in JavaScript.
Consider authentication and Azure rate limiting if expanding beyond one
static match. Keep spend alerts enabled, but note alerts are **not** spending
caps. When the free trial runs out without an upgrade, Azure may disable
services.

This implementation should not be called production-ready yet: it requires
manual cloud provisioning, role setup, a smoke test on Azure, deployment
monitoring and an end-to-end website check.

## Run free automated tests

```bash
python -m pytest api/tests -q
```
