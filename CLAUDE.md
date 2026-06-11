# Project Rules

This is the **AirStory web platform**: a React frontend in `src/` and an Express/Postgres backend in `backend/`.

## Build
- The live site builds from the **repo root only**.

## Do not touch
- Never modify `air-quality-tracker/`, `keepsake/`, or `keepsake-pre-backend/`. They are legacy snapshots.

## Version control
- `node_modules` must **never** be committed.

## Backend API
- The full backend API reference lives in `docs/API_REFERENCE.md`. **Consult it before writing any frontend code that talks to the server.**

## Git workflow
- Two long-lived branches: `main` (live/deployed — NEVER commit or push directly to main) and `dev` (integration branch).
- All work happens in short-lived `feature/*` branches created FROM dev.
- Feature branches merge into dev DIRECTLY (no pull request), then get deleted.
- dev merges into main ONLY via a pull request, with review. This is the single review gate.
- Flow: feature/* —(merge)—> dev —(PR)—> main
- Before starting any work, confirm the current branch. If on main, stop and switch.
- DEV-only flags (DEV_SKIP_LOGIN, DEV_ROLE, MOCK_DATA_ENABLED) must be OFF in anything merged toward main.

## Team structure
- Full-stack feature ownership: each member owns features end to end (frontend + backend).
- Current map: Anh — authentication and workspace/school structure; Jooeun and Jiin — Raw Data pages (student and teacher); AI-team students — data pipeline (app upload through storage).
- Cross-cutting design decisions (visibility model, data schema, workspace-to-school structure, API conventions) are team-level, not feature-level. Backend architecture decisions are led by Anh.
- Backend endpoint designs should be proposed as extensions to docs/API_REFERENCE.md (one living document).

## Working style
- When pausing for the user's input or decision, play an audio alert first: afplay /System/Library/Sounds/Glass.aiff (macOS).
