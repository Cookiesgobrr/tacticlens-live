# Archived six-a-side Foundry dashboard

The following integration belongs only to the archived dataset. The primary 11v11 studio now uses the separate [verified SIM-82 workflow](FOUNDRY_11V11.md) and static cache.

# Public dashboard: cached, real Foundry intelligence

The React application retrieves **only** GET
`https://tacticlens-api-2927.azurewebsites.net/api/verified`.
It does not expose function keys, access tokens, model API keys or POST
`/api/generate`. Model requests can only occur via the separately
protected Azure operator workflow; AI generation stays disabled in
application settings.

When the response contains `status: ready` with a verified Foundry
result, the browser additionally checks the match-clock timestamp,
numeric counts, source event IDs, and accepted verification stages
against the locally loaded synthetic event snapshot. On success, it
displays the real GPT-4.1-mini narratives, retaining replay-linked
evidence. If the feed is pending, unreachable, or mismatched, the
deterministic explanation remains available and is clearly labelled as
rule-based.

The bilingual recaps are still deterministic and should not be
presented as model-generated. The public AI result is a **cached,
pre-generated** match insight, not new inference on every visitor click.

## Required portal/CLI CORS configuration

The browser sends a cross-origin request from GitHub Pages. The Azure
Function App must explicitly allow **only** the GitHub Pages origin:

```bash
az functionapp cors add \
  --name tacticlens-api-2927 \
  --resource-group rg-tarun.jacob2927-3851 \
  --allowed-origins "https://cookiesgobrr.github.io"
```

Important: set the exact origin (no repository path, no trailing slash)
and do not use `*`. Existing origins can be inspected with
`az functionapp cors show --name tacticlens-api-2927 --resource-group
rg-tarun.jacob2927-3851`.

This is configuration only: it does not execute the model, and the
GET endpoint is public, read-only and cached. Be aware that a publicly
accessible Azure Function endpoint can still incur request, storage
and monitoring costs if abused. Keep cost monitoring enabled.

