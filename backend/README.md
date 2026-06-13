# Air Sensor Backend

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `npm install`
3. **Production (`npm start` on Render, etc.):** each start runs `db:migrate` then the API — schema is applied automatically; no Shell step required.
4. **Local dev:**
   - `npm run db:migrate` — create/update tables
   - `npm run db:seed` — reset the Lincoln workspace (clears and recreates teacher, students, sessions, and measurements)
5. Local server:
   - `npm run dev` (does **not** auto-migrate; run step 4 manually when schema changes)

## API Base

- `http://localhost:4000/api`

## Main Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/workspaces/:workspaceId/sessions`
- `POST /api/workspaces/:workspaceId/sessions`
- `GET /api/workspaces/:workspaceId/measurements`
- `POST /api/workspaces/:workspaceId/measurements`
- `PATCH /api/workspaces/:workspaceId/measurements/:measurementId`
- `GET /api/workspaces/:workspaceId/analytics/summary`
- `GET /api/workspaces/:workspaceId/heatmap`
- `GET /api/workspaces/:workspaceId/export/measurements.csv`
- `POST /api/workspaces/:workspaceId/sheets/export`

## Seeded class (Lincoln High School)

After `npm run db:seed`:

- **Teacher (workspace owner)**
  - Email: `rivera@lincoln.mock`
  - Password: `rivera2026`
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

The seed creates:

- Workspace **Lincoln High School** with **14 sessions and ~4,200 per-second measurements** across two teachers (Ms. Rivera P3/P5, Mr. Chen P2)
- Class grid: **2 periods, 6 groups**
- Join codes **P3RVK** (active) and **P5RVM** (inactive)

Sessions cover a range of visibility levels (`public`, `school`, `group`) and indoor/outdoor locations — designed to exercise the full visibility model in the Raw Data view.
