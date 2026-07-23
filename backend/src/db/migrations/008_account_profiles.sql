-- Global (account-level) profile: one row per user, independent of any workspace.
-- Unlike user_profiles (keyed by user_id + workspace_id), this holds identity a user carries
-- everywhere — so "My Page" shows the same info regardless of the workspace they're viewing.
CREATE TABLE IF NOT EXISTS account_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill a row for every existing user, seeding display_name from their account name.
INSERT INTO account_profiles (user_id, display_name)
SELECT id, COALESCE(full_name, '') FROM users
ON CONFLICT (user_id) DO NOTHING;
