Internal API Reference
Complete reference for the Airstory backend REST API (Express, backend/src). This is the internal API consumed by the React frontend (src/). For the mobile-app view of a subset of these endpoints, see ../mobile/API_SPEC.md.
________________


Conventions
* Base URL: /<host>/api
   * Local: http://localhost:4000/api
   * Production (default baked into the frontend): https://air-sensor-api.onrender.com/api
   * The frontend resolves this in src/api/http.js (REACT_APP_API_BASE_URL, with a localhost guardrail).
* Auth: Send Authorization: Bearer <accessToken> on every protected route. The access token is a JWT ({ userId, email }) valid for 15 minutes; refresh it via POST /auth/refresh.
* Content type: Request and response bodies are JSON unless noted (CSV export returns text/csv). The JSON body limit is 12 MB (set in backend/src/app.js) to accommodate large CSV imports.
* Validation: Bodies/params/queries are validated with Zod (backend/src/middleware/validate.js). Validation failures return 400 with an error describing the field.
* Error shape: { "error": "human-readable message" }. Status codes used: 400 (bad input), 401 (missing/invalid token), 403 (not a member / insufficient role), 404 (not found), 409 (conflict, e.g. duplicate email/join code), 503 (integration not configured).
* Success envelopes: Responses wrap the payload in a named key, e.g. { "measurements": [...] }, { "session": {...} }, { "joinCode": {...} }. 204 No Content is returned for deletes and some updates.
Authorization guards
Two middleware functions gate every protected route (backend/src/middleware/auth.js):
Guard
	Effect
	requireAuth
	Rejects with 401 unless a valid Bearer access token is present. Sets req.user = { userId, email }.
	requireWorkspaceRole([roles])
	Looks up the caller's membership for the :workspaceId path param. 403 if not a member, or if their role isn't in the allowed list. Sets req.workspaceRole.
	Roles are owner, teacher, student. owner is the workspace creator (teacher who registered); teacher is a co-teacher; student is a class member. In role tables below, "T/O" means owner or teacher, and "any member" means owner, teacher, or student.
________________


Auth & class management — /api/auth
Mounted in backend/src/app.js as app.use("/api/auth", authRoutes) (backend/src/modules/auth/auth.routes.js).
POST /auth/register
Create a user. Teacher registration (role: "teacher" with no join code) creates a new workspace and makes the user its owner. Student registration requires a valid joinCode and attaches the student to that code's workspace, validating period/group against the workspace class structure.
* Auth: none
* Body:
   * email (string, required) — normalized to lowercase
   * password (string, ≥ 8, required)
   * fullName (string, ≥ 2, required)
   * workspaceName (string, ≥ 2, default "Default Workspace") — used when creating a workspace
   * role ("student" | "teacher", default "student")
   * schoolCode, instructor, period, groupCode, studentCode (strings, optional) — profile fields
   * joinCode (5-char [A-Z0-9], optional) — required for students
   * joinWorkspaceId (uuid, optional) — explicit invite flow
* Success: 201 { accessToken, refreshToken, user: { id, email, fullName, workspaceId } }
* Errors: 400 (missing join code for student, invalid period/group, invalid/inactive code), 409 (email exists)
POST /auth/login
* Auth: none
* Body: email (string), password (string)
* Success: 200 { accessToken, refreshToken, user: { id, email, fullName, workspaceId } } (workspaceId is the caller's most recently created workspace membership)
* Errors: 401 invalid credentials
POST /auth/phg-session
Passwordless shared-account login. Issues the same JWT bundle as /login for the shared phg-students@airstory.local account — no password. Intentionally public (same threat model as embedding a password in the frontend bundle). See the doc comment at auth.routes.js:192. Not used by the current src/ frontend; still live in the backend.
* Auth: none
* Body: none
* Success: 200 { accessToken, refreshToken, user }
* Errors: 503 if the shared student/workspace isn't seeded on this DB (run npm run db:upsert-teacher)
POST /auth/refresh
* Auth: none (validated against the stored refresh token)
* Body: refreshToken (string, required)
* Success: 200 { accessToken }
* Errors: 400 missing token, 401 token invalid/expired/not in DB
POST /auth/logout
Deletes the supplied refresh token from the DB. Idempotent.
* Auth: none
* Body: refreshToken (string, optional)
* Success: 204
POST /auth/change-password
* Auth: requireAuth
* Body: email (must equal the signed-in account's email — confirmation), newPassword (≥ 8)
* Effect: rehashes the password and revokes all refresh tokens for the user.
* Success: 204
* Errors: 403 if email doesn't match the token
GET /auth/me
* Auth: requireAuth
* Success: 200 { user: { id, email, full_name }, memberships: [{ workspace_id, role }], profile: {...} | null }
PATCH /auth/me/profile
Update the signed-in user's own profile row (user_profiles). Only provided fields change.
* Auth: requireAuth
* Body (all optional): schoolCode, instructor, period, groupCode
* Success: 200 { profile }
* Errors: 404 profile not found
GET /auth/join-code/:code/config
Public lookup so the student signup form can pre-fill workspace/period/group options from a join code.
* Auth: none (validates the 5-char code format)
* Success: 200 { workspaceId, schoolCode, instructor, periods, groupsByPeriod, periodCount, groupCount }
* Errors: 404 invalid/inactive code
GET /auth/workspaces/:workspaceId/roster
* Auth: requireAuth + must be a member of the workspace (checked inline, 403 otherwise)
* Success: 200 { members: [{ id, full_name, email, role, school_code, instructor, period, group_code, student_code }] }
GET /auth/workspaces/:workspaceId/class-structure
* Auth: any member
* Success: 200 { periods, groupsByPeriod, periodCount, groupCount } (defaults to 1 period / 4 groups if unset)
PATCH /auth/workspaces/:workspaceId/class-structure
Upsert the period/group grid for a workspace.
* Auth: T/O
* Body: periodCount (int 1–12), groupCount (int 1–12)
* Success: 200 updated structure object
GET /auth/workspaces/:workspaceId/join-codes
* Auth: T/O
* Success: 200 { joinCodes: [{ id, code, school_code, instructor, active, created_at }] }
POST /auth/workspaces/:workspaceId/join-codes
* Auth: T/O
* Body: code (5-char [A-Z0-9], uppercased), schoolCode?, instructor?, active? (default true)
* Success: 201 { joinCode }
* Errors: 409 code already exists
PATCH /auth/workspaces/:workspaceId/join-codes/:codeId
Enable/disable a join code.
* Auth: T/O
* Body: active (boolean)
* Success: 200 { joinCode } · Errors: 404 not found
POST /auth/workspaces/:workspaceId/users/:userId/reset-password
Teacher resets a student's password. Revokes that student's refresh tokens.
* Auth: T/O (target must be a student in the workspace)
* Body: newPassword (≥ 8)
* Success: 204 · Errors: 404 student not in workspace
PATCH /auth/workspaces/:workspaceId/users/:userId/placement
Move a student to a different period/group.
* Auth: T/O (target must be a student)
* Body: period (string), groupCode (string)
* Success: 200 { profile } · Errors: 404 student/profile not found
DELETE /auth/workspaces/:workspaceId/users/:userId
Remove a student from the workspace (deletes their profile + membership; the user row remains).
* Auth: T/O (target must be a student)
* Success: 204 · Errors: 404 student not in workspace
________________


Sessions & measurements — /api
Mounted as app.use("/api", sensorRoutes) (backend/src/modules/sensor/sensor.routes.js). All routes require requireAuth (applied router-wide).
GET /workspaces/:workspaceId/sessions
* Auth: any member
* Success: 200 { sessions: [...] } ordered by created_at DESC
POST /workspaces/:workspaceId/sessions
* Auth: T/O
* Body: sessionCode (req), name (req), notes?, locationName?, schoolCode?, instructor?, period?, groupCode?, startedAt? (ISO datetime), endedAt? (ISO datetime)
* Success: 201 { session }
DELETE /workspaces/:workspaceId/sessions/:sessionId
Transactional; cascades to that session's measurements.
* Auth: T/O
* Success: 204 · Errors: 404 session not found
GET /workspaces/:workspaceId/measurements
Returns measurements joined to their session, with the latest edit per field aggregated into an edits JSONB object ({ pm25: { editedValue, originalValue, editedByUserId, editNote, createdAt }, ... }).
* Auth: any member
* Query params (all optional): from, to (ISO datetimes, filter captured_at), sessionId, schoolCode, instructor, groupCode, limit (default 200), offset (default 0)
* Success: 200 { measurements: [...] } ordered by captured_at DESC
POST /workspaces/:workspaceId/measurements
* Auth: T/O
* Body: sessionId (uuid), capturedAt (ISO datetime), latitude?, longitude?, indoorOutdoor? ("INDOOR" | "OUTDOOR"), pm25, co, temp, humidity (all numbers required)
* Success: 201 { measurement }
PATCH /workspaces/:workspaceId/measurements/:measurementId
Direct value correction (camelCase keys map to snake_case columns automatically).
* Auth: T/O
* Body (any subset): pm25?, co?, temp?, humidity?, indoorOutdoor?
* Success: 200 { measurement } · Errors: 400 no fields, 404 not found
POST /workspaces/:workspaceId/measurements/:measurementId/edits
Append an audit-trail edit (records original + edited value + note) without losing history. This is how students propose corrections.
* Auth: any member
* Body: fieldName ("pm25" | "co" | "temp" | "humidity"), editedValue (number), editNote? (≤ 300)
* Success: 201 { edit } · Errors: 404 measurement not found
POST /workspaces/:workspaceId/import/csv
Bulk import. Transactional: de-duplicates/creates sessions by (sessionCode, school, instructor, period, group, location) and inserts all measurement rows, rolling back entirely on any failure.
* Auth: any member
* Body: rows — array (1–10000) of: capturedAt (ISO, req), sessionCode?, sessionName?, sessionNotes?, location?, school?, instructor?, period?, group?, indoorOutdoor? (accepts IN/INSIDE→INDOOR), latitude?, longitude?, pm25, co, temp, humidity (numbers required)
* Success: 201 { importedCount }
DELETE /workspaces/:workspaceId/measurements
Wipe all measurements, edits, and sessions for the workspace (transactional). Used by "clear data".
* Auth: T/O
* Success: 204
________________


Analytics & reference data — /api
Mounted as app.use("/api", analyticsRoutes) (backend/src/modules/analytics/analytics.routes.js). All routes require requireAuth. The metric query param accepts pm25 (default), co, temp, humidity.
GET /workspaces/:workspaceId/analytics/summary
* Auth: any member
* Query: metric?, from?, to?
* Success: 200 { metric, summary: { mean, min, max, median, stddev, sample_count } }
* Errors: 400 invalid metric
GET /workspaces/:workspaceId/heatmap
Latitude/longitude rounded to 4 decimals and averaged per bucket (drops null coordinates).
* Auth: any member
* Query: metric?
* Success: 200 { metric, points: [{ latitude, longitude, value, point_count }] }
GET /workspaces/:workspaceId/export/measurements.csv
* Auth: any member
* Success: 200 text/csv attachment (measurements.csv) with measurement + session columns
GET /analytics/openaq/daily
Server-side proxy to OpenAQ v3 for reference daily averages near a location (keeps the API key off the client). See ../OPENAQ.md.
* Auth: requireAuth
* Query: lat (req), lng (req), date_from (req, YYYY-MM-DD), date_to (req), metric?
* Success: 200 OpenAQ daily series
* Errors: 400 missing/invalid params or unsupported metric, 503 no API key configured
GET /analytics/openaq/heatmap
* Auth: requireAuth
* Query: lat (req), lng (req), metric?, radius? (default 15000 m), limit? (default 25)
* Success: 200 nearby reference points
* Errors: 400 missing/invalid params, 503 no API key
________________


Google Sheets export — /api
Mounted as app.use("/api", sheetsRoutes) (backend/src/modules/sheets/sheets.routes.js).
POST /workspaces/:workspaceId/sheets/export
Writes the latest ≤ 5000 sessions and ≤ 5000 measurements to the sessions and measurements tabs of the configured Google Sheet (service-account auth).
* Auth: T/O
* Success: 200 { ok: true, exported: { sessions, measurements } }
* Errors: 500 if GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY are missing
________________


Health
GET /health
Unauthenticated uptime check (defined in backend/src/app.js). Returns { ok: true, environment }.