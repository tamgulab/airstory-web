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
