-- Full schema. DDL only: reference rows (school catalog, aggregate workspaces) are
-- created by src/db/reference.js, which runs after this on every boot.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  -- Firebase owns credentials/identity; this links each app user to its Firebase account.
  -- Unique so a Firebase account maps to at most one app user, and so we can ON CONFLICT on it.
  firebase_uid TEXT,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_key ON users(firebase_uid);

-- Directory of schools teachers pick from in account settings. Rows come from
-- src/db/reference.js, keyed by name. Coordinates are nullable: only schools that
-- can be placed accurately get a Heat Map pin, and only those are selectable.
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- 'class' = a user-created workspace (a class, or a general user's team; holds data).
  -- 'school' = read-only aggregate view of one school's data.
  -- 'public' = single read-only aggregate view of all public data.
  -- Aggregate workspaces store no data of their own; they surface data held by 'class'
  -- workspaces through the kind-aware read queries.
  kind TEXT NOT NULL DEFAULT 'class' CHECK (kind IN ('class', 'school', 'public')),
  -- A 'class' workspace's school_id is set by its teacher (NULL until then, and NULL for a
  -- general user's school-less workspace). A 'school' workspace's school_id is its school.
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_school_id ON workspaces(school_id);

-- At most one 'school' workspace per school, and exactly one 'public' workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspace_per_school
  ON workspaces(school_id) WHERE kind = 'school';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_public_workspace
  ON workspaces(kind) WHERE kind = 'public';

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_class_structures (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  period_count INTEGER NOT NULL DEFAULT 1,
  group_count INTEGER NOT NULL DEFAULT 4,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_period_count CHECK (period_count BETWEEN 1 AND 12),
  CONSTRAINT chk_group_count CHECK (group_count BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  session_code TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  location_name TEXT DEFAULT '',
  school_code TEXT DEFAULT '',
  instructor TEXT DEFAULT '',
  period TEXT DEFAULT '',
  group_code TEXT DEFAULT '',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visibility TEXT NOT NULL DEFAULT 'school' CHECK (visibility IN ('public', 'school')), -- how far the data reaches: 'school' (its school) or 'public' (everyone)
  owner_student_code TEXT DEFAULT '' --identify owner of the session
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code);

CREATE TABLE IF NOT EXISTS measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  indoor_outdoor TEXT CHECK (indoor_outdoor IN ('INDOOR', 'OUTDOOR')),
  pm25 DOUBLE PRECISION NOT NULL,
  co DOUBLE PRECISION NOT NULL,
  temp DOUBLE PRECISION NOT NULL,
  humidity DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurements_workspace_time ON measurements(workspace_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_session_id ON measurements(session_id);

CREATE TABLE IF NOT EXISTS measurement_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  measurement_id UUID NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
  edited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  field_name TEXT NOT NULL CHECK (field_name IN ('pm25', 'co', 'temp', 'humidity')),
  original_value DOUBLE PRECISION NOT NULL,
  edited_value DOUBLE PRECISION NOT NULL,
  edit_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurement_edits_measurement_id_created
  ON measurement_edits(measurement_id, created_at DESC);

CREATE TABLE IF NOT EXISTS session_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-workspace profile: who a user is inside one class.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  school_code TEXT DEFAULT '',
  instructor TEXT DEFAULT '',
  period TEXT DEFAULT '',
  group_code TEXT DEFAULT '',
  student_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_workspace_id ON user_profiles(workspace_id);

-- Global (account-level) profile: one row per user, independent of any workspace.
-- Unlike user_profiles (keyed by user_id + workspace_id), this holds identity a user carries
-- everywhere - so "My Page" shows the same info regardless of the workspace they're viewing.
CREATE TABLE IF NOT EXISTS account_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- normalized lowercase
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  token TEXT NOT NULL UNIQUE, -- 32 random bytes, base64url
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '', -- optional display name, shown pre-filled on /join
  period TEXT DEFAULT '', -- optional pre-placement for student invitees
  group_code TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- At most one pending invite per (workspace, email); re-inviting upserts onto this index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitations_pending_ws_email
  ON invitations(workspace_id, email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON invitations(workspace_id);
