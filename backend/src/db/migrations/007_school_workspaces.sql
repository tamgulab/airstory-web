-- Public + per-school aggregate workspaces.
-- A 'school' workspace is a read-only view over every class that belongs to that school;
-- the single 'public' workspace is a read-only view over all sessions flagged visibility='public'.
-- Data is never stored in these workspaces — it lives in 'class' workspaces and is surfaced here
-- by the kind-aware read queries. Runs after 006_schools.sql so the schools FK resolves.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- A 'class' workspace's school_id is set by its teacher (NULL until then, and NULL for a
-- general user's school-less workspace). A 'school' workspace's school_id identifies its school.
CREATE INDEX IF NOT EXISTS idx_workspaces_school_id ON workspaces(school_id);

-- At most one 'school' workspace per school, and exactly one 'public' workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspace_per_school
  ON workspaces(school_id) WHERE kind = 'school';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_public_workspace
  ON workspaces(kind) WHERE kind = 'public';

-- The singleton public workspace.
INSERT INTO workspaces (name, kind)
  SELECT 'Public', 'public'
  WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE kind = 'public');

-- One read-only workspace per school in the directory.
INSERT INTO workspaces (name, kind, school_id)
  SELECT s.name, 'school', s.id FROM schools s
  ON CONFLICT DO NOTHING;
