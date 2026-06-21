# Air Sensor Backend

Express + Postgres API. Authentication is handled by **Firebase**: the client signs in with the
Firebase SDK and sends the resulting ID token as `Authorization: Bearer <idToken>`; this server
verifies it with the Firebase Admin SDK and provisions/loads the matching app account.

## Setup

1. Copy `.env.example` to `.env` and fill values — `DATABASE_URL` plus the three `FIREBASE_*`
   Admin service-account values (Firebase console → Project settings → Service accounts →
   Generate new private key).
2. `npm install`
3. **Production (`npm start` on Render, etc.):** each start runs `db:migrate` then the API —
   schema is applied automatically; no Shell step required.
4. **Local dev:**
   - `npm run db:migrate` — create/update tables
   - `npm run db:seed` — reset the Lincoln workspace (clears and recreates the teacher, students,
     sessions, and measurements)
5. `npm run dev` (does **not** auto-migrate; run step 4 manually when the schema changes)

## Authentication

- **No password or session endpoints live here.** Login, logout, token refresh, and self-service
  password changes are all done by the **Firebase client SDK**. Teacher-initiated student password
  resets go through the Admin SDK (`POST /auth/workspaces/:workspaceId/users/:userId/reset-password`).
- `POST /api/auth/register` provisions the app account (workspace / membership / profile) for a user
  who is already signed in to Firebase.
- **Two roles:** `teacher` and `student`. Role checks use `requireWorkspaceRole(...)`.
- Firebase Admin requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
  (keep the key on one line with literal `\n` newlines).

## API Base

- `http://localhost:4000/api`

Full reference: [`docs/openapi.yaml`](../docs/openapi.yaml). Key endpoints:

- `POST /api/auth/register` — provision app account (after Firebase sign-in)
- `GET /api/auth/me` — current user, memberships, profile
- `PATCH /api/auth/me/profile` — update own school/class/period/group
- `GET /api/auth/join-code/:code/config` — look up a join code (returns its workspace + **period**)
- `GET /api/auth/workspaces/:workspaceId/roster`
- `GET|POST /api/auth/workspaces/:workspaceId/join-codes` · `PATCH .../join-codes/:codeId`
- `GET|PATCH /api/auth/workspaces/:workspaceId/class-structure`
- `PATCH /api/auth/workspaces/:workspaceId/users/:userId/placement` — teacher assigns a student's group
- `GET|POST /api/workspaces/:workspaceId/sessions` · `GET|POST /api/workspaces/:workspaceId/measurements`
- `GET /api/workspaces/:workspaceId/analytics/summary` · `/heatmap` · `/export/measurements.csv`

## Seeded class (Lincoln High School)

After `npm run db:seed`:

- **Teacher**
  - Email: `rivera@lincoln.mock` · Password: `rivera2026`
  - School code: **LINCOLN**

- **Students (10 accounts, shared password `lincoln2026`)**

  | Email | Period | Group | Student code |
  |-------|--------|-------|-------------|
  | `ava.martinez@lincoln.mock` | P3 | G1 | DEV001 |
  | `lincoln-p3-g1@lincoln.mock` | P3 | G1 | STU002 |
  | `liam.chen@lincoln.mock` | P3 | G2 | STU003 |
  | `noah.patel@lincoln.mock` | P3 | G3 | STU004 |
  | `olivia.brown@lincoln.mock` | P5 | G1 | STU005 |
  | `sophia.garcia@lincoln.mock` | P5 | G2 | STU006 |
  | `mason.lee@lincoln.mock` | P5 | G2 | STU007 |
  | `lincoln-p5-g3@lincoln.mock` | P5 | G3 | STU008 |
  | `emma.davis@lincoln.mock` | P5 | G4 | STU009 |
  | `lucas.kim@lincoln.mock` | P5 | G5 | STU010 |

  P5 · G6 has no account (intentional coverage gap).

The seed also creates:

- Workspace **Lincoln High School** with **14 sessions and ~4,200 per-second measurements**
  (Ms. Rivera's P3/P5 classes, plus P2 sessions labelled with instructor "Mr. Chen")
- Class grid: **2 periods, 6 groups**
- Join codes **P3RVK** (active, period **P3**) and **P5RVM** (inactive, period **P5**) — a code's
  period is assigned to any student who signs up with it

Sessions cover a range of visibility levels (`public`, `school`, `group`) and indoor/outdoor
locations — designed to exercise the full visibility model in the Raw Data view.
