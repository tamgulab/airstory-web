-- Optional display name teachers pre-assign when inviting (shown pre-filled on /join).
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
