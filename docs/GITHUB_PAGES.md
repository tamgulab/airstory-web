# GitHub Pages deployment

## Canonical frontend location

The **main React app** lives at the **repository root**: `package.json`, `src/`, `public/`.

The nested folder `air-quality-tracker/` is a **legacy / alternate CRA tree** (older dashboard-only prototype). **GitHub Actions and manual deploy must build from the root**, not from `air-quality-tracker/`.

If the live site shows old behavior (e.g. Manhattan map, missing Raw Data fixes), the Pages bundle was almost certainly built from the wrong directory or an old commit—fix CI/build source first, not only hard refresh.

## Automatic deploy (recommended)

Workflow: [.github/workflows/deploy-gh-pages.yml](../.github/workflows/deploy-gh-pages.yml).

Do **not** keep GitHub’s template workflow that uploads **`path: '.'`** (whole repo) to Pages — Create React App’s `index.html` lives in **`build/`** after `npm run build`, so that template makes the site **404**.

- Triggers on push to `main` when `src/`, `public/`, `package.json`, `package-lock.json`, Tailwind/PostCSS configs, or the workflow file change (also **Actions → Run workflow**).
- Runs `npm ci` and `npm run build` at the **repo root**, uploads `build/` as a Pages artifact, then **`actions/deploy-pages`** publishes it.

### Repository secrets (Actions build)

| Name | Purpose |
|------|--------|
| `REACT_APP_API_BASE_URL` | Full API base URL ending in `/api`, e.g. `https://air-sensor-api.onrender.com/api`. If omitted, the workflow uses the same default as [DEPLOY_RENDER.md](DEPLOY_RENDER.md). |
| `REACT_APP_MAP_STYLE_URL` | Optional repository variable for a custom MapLibre-compatible style. The app defaults to OpenFreeMap's keyless Liberty style. |

GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

**Important:** The site is built on **GitHub Actions**, not on your laptop — **local `.env` is never uploaded.** You must create the secret on the **same repo** that hosts the site (e.g. `haetalkim/airstory`), not only on another fork/clone.

The workflow’s **build** job uses the **`github-pages` environment**. If you override the map style, add `REACT_APP_MAP_STYLE_URL` under **Settings → Secrets and variables → Actions → Variables**. No map API key is required for the default style.

### GitHub Pages settings (must match this workflow)

**Settings → Pages → Build and deployment**

- Source: **GitHub Actions** (not “Deploy from a branch”).

If Source is **Deploy from a branch → gh-pages**, pushes from this workflow **do not** update the live URL—you must either switch Source to **GitHub Actions**, **or** deploy only via **`npm run deploy`** (updates the `gh-pages` branch).

### First deploy / stuck deploy

- Open **Actions**, select **Deploy GitHub Pages**. If the **deploy** job waits on **Environment**, open the run and **approve** deployment for **`github-pages`** (one-time for protected environments).
- After a successful run, the Pages UI should list the workflow under “GitHub Actions”.

### Backend checklist (feature parity)

After changing auth or profile APIs, redeploy the **Render** (or other) API so the deployed frontend can call:

- `PATCH /auth/me/profile`
- `GET /auth/workspaces/:id/class-structure` (including student role if you rely on Raw Data for students)

Mismatch between frontend bundle and API version often looks like “Save does nothing” or stale dropdowns.

## Manual deploy (same artifact as CI)

From repo root:

```bash
# Optional: .env with REACT_APP_API_BASE_URL=https://your-api.../api
npm run build
npm run deploy   # gh-pages branch via scripts/deploy-github-pages.sh
```

Ensure **`homepage`** in root `package.json` stays **`"."`** so asset URLs work on GitHub Pages subpaths (see [VERCEL.md](VERCEL.md)).
