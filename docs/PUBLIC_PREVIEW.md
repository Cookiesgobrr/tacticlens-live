# Public TacticLens preview (no Azure billing)

This optional deployment hosts the existing React dashboard with a precomputed
synthetic match snapshot on GitHub Pages. This is **not an Azure deployment**,
**not live FastAPI**, and **not live AI inference**. The real Foundry agent code
remains separate and opt-in.

## Activate after merging the PR

1. In GitHub, go to Repository Settings > Pages.
2. Under Build and deployment, select **Source: GitHub Actions**.
3. Open Actions > **Deploy free public preview**. If it has not run since
   enabling Pages, choose **Run workflow** on main.
4. Wait for the job to succeed, then inspect the deployment URL in the job.

The expected project-pages URL (only after deployment succeeds) is:
https://cookiesgobrr.github.io/tacticlens-live/

If the repo does not permit GitHub Pages, review repository visibility,
GitHub Actions permissions, and account/repository restrictions.

## Verify locally before merge

    python -m pytest api/tests -q
    python -m api.export_static_demo
    cd web
    GITHUB_PAGES=true VITE_STATIC_DEMO=true npm run build

The exported JSON is ignored by Git, and generated for each deployment directly
from api/simulator.py and api/analytics.py to avoid drift between demo and
FastAPI. The browser loads the snapshot directly on static hosting, and the
existing local FastAPI flow remains unchanged.

This gives judges a free public working browser UI and evidence trail before
Azure resources become available. It does **not** satisfy any requirement for
real Foundry inference, backend hosting, or Azure cloud-native integration.
