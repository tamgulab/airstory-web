CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- normalized lowercase
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  token TEXT NOT NULL UNIQUE, -- 32 random bytes, base64url
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
