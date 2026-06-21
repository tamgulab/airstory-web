# AIRSTORY

Air quality classroom platform: React dashboard + Express/Postgres API. Authentication is handled by **Firebase**.

| Folder | Purpose |
|--------|---------|
| `src/` | **Main app** — login, heat map, raw data, analysis, My Page, Manage Classes |
| `backend/` | Node API (auth, sessions, measurements, analytics) |
| `docs/` | API reference (`openapi.yaml`) and deploy guides (`DEPLOY_RENDER.md`, `VERCEL.md`, `GITHUB_PAGES.md`) |

## Authentication & roles

- Sign-in is done by the **Firebase client SDK** (email/password or **Continue with Google**); the backend verifies the Firebase ID token and provisions the matching app account.
- There are **two roles: `teacher` and `student`.**
  - **Teacher** — creates a workspace, manages classes, and generates join codes. Each join code is tied to a **class period**.
  - **Student** — signs up with a teacher's join code. The code assigns their **period** automatically; the **teacher assigns their group** afterward in Manage Classes.
- **First-time Google users** land on a short onboarding screen to confirm their name and pick a role (students also enter a join code).

## Local Development

### Prerequisites

- Node.js
- Docker (for the database)
- A **Firebase project** (for authentication — see below)

### 1. Firebase setup (required for login)

In the [Firebase console](https://console.firebase.google.com/):

1. **Authentication → Sign-in method:** enable **Email/Password** and **Google**.
2. **Project settings → Your apps → Web app:** copy the web config — these are the frontend `REACT_APP_FIREBASE_*` values (step 4).
3. **Project settings → Service accounts → Generate new private key:** download the JSON — these are the backend `FIREBASE_*` values (step 3).

### 2. Start the database

```bash
docker compose up -d
```

Starts PostgreSQL 16 from `docker-compose.yml` (`air_sensor` database, user/password `postgres`).

### 3. Set up the backend

```bash
cd backend
cp .env.example .env
```

In `.env`, set `DATABASE_URL` (the default matches `docker compose`) and the three Firebase Admin values from the service-account key:

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Then install, migrate, seed, and run:

```bash
npm install
npm run db:migrate   # create tables
npm run db:seed      # seed Lincoln workspace: teacher, 10 students, 14 sessions
npm run dev          # runs on http://localhost:4000
```

### 4. Start the frontend

In the repo root:

```bash
cp .env.example .env   # fill in the REACT_APP_FIREBASE_* web config
npm install
npm start              # runs on http://localhost:3000
```

The frontend automatically points at `http://localhost:4000/api` on localhost — leave `REACT_APP_API_BASE_URL` blank for local dev. `REACT_APP_GOOGLE_MAPS_API_KEY` is only needed for the heat-map view.

### 5. Log in

| Role | Email | Password |
|---|---|---|
| Teacher | `rivera@lincoln.mock` | `rivera2026` |
| Student (any) | `ava.martinez@lincoln.mock` | `lincoln2026` |

> Seeded accounts use Firebase email/password (created by `db:seed` via the Admin SDK). Open **Manage Classes** to inspect join codes and the student roster. To try Google sign-in, use any Google account — you'll be sent through onboarding.

### Useful commands

| Command | Description |
|---|---|
| `docker compose up -d` | Start the database |
| `docker compose down` | Stop the database |
| `docker compose down -v` | Drop the database (fresh start — re-run `db:migrate` + `db:seed`) |
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:seed` | Reset the Lincoln workspace (teacher + students + sessions + measurements) |

## Deployment

- **Render** (`render.yaml` Blueprint — API + Postgres): `docs/DEPLOY_RENDER.md`
- **GitHub Pages** (frontend, via `.github/workflows/deploy-gh-pages.yml` or `npm run deploy`): `docs/GITHUB_PAGES.md`
- **Vercel** (optional): `docs/VERCEL.md`

For static builds, the `REACT_APP_*` values (API base, Firebase config, Maps key) are baked in at build time and must be provided as environment variables / Actions secrets.
