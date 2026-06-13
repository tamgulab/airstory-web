# AIRSTORY

Air quality classroom platform: React dashboard + Express/Postgres API.

| Folder | Purpose |
|--------|---------|
| `src/` | **Main app** — student/teacher login, heat map, raw data, analysis, My Page |
| `backend/` | Node API (auth, sessions, measurements, analytics) |
| `docs/` | Deploy guides (`DEPLOY_RENDER.md`, `VERCEL.md`, **`GITHUB_PAGES.md`**), mobile API docs |
| `air-quality-tracker/` | **Legacy** smaller CRA app — **do not use** for production builds; CI builds from **repo root** only |
| `keepsake/integrated-frontend-snapshot/` | Frozen copy of `src/` + configs (restore / diff reference) |
| `keepsake-pre-backend/` | Older UI snapshot before backend work |

**Frontend (canonical): GitHub Pages** — the live site must be built from **this repo root** (`npm run build`), not from `air-quality-tracker/`.

- **CI:** push to `main` runs [.github/workflows/deploy-gh-pages.yml](.github/workflows/deploy-gh-pages.yml) (see **[docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md)** for secrets + troubleshooting).
- **Manual:** `npm run deploy` uses `scripts/deploy-github-pages.sh` and **`CACHE_DIR`** outside the repo. Before deploy, set in `.env` (baked into the static build): `REACT_APP_API_BASE_URL`, and **`REACT_APP_GOOGLE_MAPS_API_KEY`** for the heat map. CI needs the same vars as **Actions secrets** (see [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md)).

GitHub: **Settings → Pages** — source **GitHub Actions** so the workflow in `.github/workflows/deploy-gh-pages.yml` can publish (artifact + deploy-pages). For branch-only deploys, use **`npm run deploy`** instead (see [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md)).

**Vercel:** not required if you only use Pages. If `git push` still triggers Vercel builds, disconnect the project in Vercel (see **`docs/VERCEL.md` → “GitHub Pages만 쓸 때”**).

**Render:** `render.yaml` Blueprint — API + Postgres. See `docs/DEPLOY_RENDER.md`.

## Local Development

### Prerequisites

- Node.js
- Docker (for the database)

### 1. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container using the settings in `docker-compose.yml` (`air_sensor` database, user `postgres`, password `postgres`).

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set the two JWT secrets to any long random strings:

```
JWT_ACCESS_SECRET=<any-long-random-string>
JWT_REFRESH_SECRET=<any-other-long-random-string>
```

Then install dependencies, run migrations, and seed the database:

```bash
npm install
npm run db:migrate   # create tables
npm run db:seed      # seed Lincoln workspace: teacher, 10 students, 14 sessions
```

Start the backend:

```bash
npm run dev          # runs on http://localhost:4000
```

### 3. Start the frontend

In the repo root:

```bash
npm install
npm start            # runs on http://localhost:3000
```

No `.env` file is needed for local dev — the frontend automatically points to `http://localhost:4000/api` when running on localhost. A `REACT_APP_GOOGLE_MAPS_API_KEY` is only required for the heat map view.

### 4. Log in

| Role | Email | Password |
|---|---|---|
| Teacher | `rivera@lincoln.mock` | `rivera2026` |
| Student (any) | `ava.martinez@lincoln.mock` | `lincoln2026` |

The seed creates 14 sessions with full per-second measurements. Open Manage Classes to inspect join codes and the student roster.

### Useful commands

| Command | Description |
|---|---|
| `docker compose up -d` | Start the database |
| `docker compose stop` | Stop the database |
| `docker compose down` | Stop the database (Switching branches/Done with project)|
| `docker compose down -v` | Fresh database
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:seed` | Reset Lincoln workspace (teacher + students + sessions + measurements) |
