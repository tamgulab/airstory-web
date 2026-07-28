# GitHub Pages deployment

## Canonical frontend location

The **main React app** lives at the **repository root**: `package.json`, `src/`, `public/`. The build runs from the root only.

If the live site shows old behavior, the Pages bundle was almost certainly built from an old commit, or Pages **Source** is not set to GitHub Actions (see below). Fix the build source first, not only hard refresh.

## Deploy

Workflow: [.github/workflows/deploy-gh-pages.yml](../.github/workflows/deploy-gh-pages.yml).

Do **not** keep GitHub’s template workflow that uploads **`path: '.'`** (whole repo) to Pages — Create React App’s `index.html` lives in **`build/`** after `npm run build`, so that template makes the site **404**.

- **Push to `main` is the only trigger**, and only when `src/`, `public/`, `package.json`, `package-lock.json`, Tailwind/PostCSS configs, or a workflow file change. There is no `workflow_dispatch`, so **Actions → Run workflow** is not available: to force a rebuild, push a commit touching one of those paths.
- Runs `npm ci` and `npm run build` at the **repo root**, uploads `build/` as a Pages artifact, then **`actions/deploy-pages`** publishes it.
- A backend-only or docs-only merge to `main` deliberately does **not** redeploy the frontend.

### Repository secrets (Actions build)

| Name | Purpose |
|------|--------|
| `REACT_APP_API_BASE_URL` | Full API base URL ending in `/api`, e.g. `https://air-sensor-api.onrender.com/api`. If omitted, the workflow uses the same default as [DEPLOY_RENDER.md](DEPLOY_RENDER.md). |
| `REACT_APP_MAP_STYLE_URL` | Optional repository variable for a custom MapLibre-compatible style. The app defaults to OpenFreeMap's keyless Liberty style. |

GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

**Important:** The site is built on **GitHub Actions**, not on your laptop, so **local `.env` is never uploaded.** Create the secret on the **same repo** that hosts the site (`tamgulab/airstory-web`), not on a fork or clone.

The workflow’s **build** job uses the **`github-pages` environment**. If you override the map style, add `REACT_APP_MAP_STYLE_URL` under **Settings → Secrets and variables → Actions → Variables**. No map API key is required for the default style.

### GitHub Pages settings (must match this workflow)

**Settings → Pages → Build and deployment**

- Source: **GitHub Actions** (not “Deploy from a branch”).

If Source is **Deploy from a branch → gh-pages**, pushes from this workflow **do not** update the live URL. The run still goes green and publishes an artifact that nobody serves, so a stale site with a passing Actions tab is the symptom. Switch Source to **GitHub Actions**.

The legacy `gh-pages` branch is left over from the old `npm run deploy` flow and is **no longer updated**. It can be deleted once Source is confirmed.

### First deploy / stuck deploy

- Open **Actions**, select **Deploy GitHub Pages**. If the **deploy** job waits on **Environment**, open the run and **approve** deployment for **`github-pages`** (one-time for protected environments).
- After a successful run, the Pages UI should list the workflow under “GitHub Actions”.

### Backend checklist (feature parity)

After changing auth or profile APIs, redeploy the **Render** (or other) API so the deployed frontend can call:

- `PATCH /auth/me/profile`
- `GET /auth/workspaces/:id/class-structure` (including student role if you rely on Raw Data for students)

Mismatch between frontend bundle and API version often looks like “Save does nothing” or stale dropdowns.

## Local build check

There is no manual deploy path. The `gh-pages` package, the `deploy`/`predeploy` scripts, and `scripts/deploy-github-pages.sh` were all removed; publishing happens only through the workflow above.

To reproduce the CI build locally without publishing:

```bash
# Optional: .env with REACT_APP_API_BASE_URL=https://your-api.../api
npm ci
npm run build   # output in build/, same artifact CI uploads
```

Ensure **`homepage`** in root `package.json` stays **`"."`** so asset URLs resolve on the GitHub Pages subpath (`/airstory-web/`). An absolute `/` breaks every asset on a project page.
