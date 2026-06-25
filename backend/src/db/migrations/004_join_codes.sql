CREATE TABLE IF NOT EXISTS join_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  school_code TEXT DEFAULT '',
  instructor TEXT DEFAULT '',
  period TEXT DEFAULT '', -- class period this code enrolls students into (assigned automatically on signup)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_codes_workspace_id ON join_codes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_join_codes_code ON join_codes(code);
