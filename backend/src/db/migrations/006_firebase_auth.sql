-- Firebase Auth migration.
-- Firebase is now the identity provider: it owns credentials (passwords) and issues ID tokens.
-- The backend keeps owning all domain data (users, workspaces, memberships, profiles) and
-- links each app user to its Firebase account via firebase_uid.

-- Link column. Unique so a Firebase account maps to at most one app user, and so we can ON CONFLICT on it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_key ON users(firebase_uid);

-- Passwords now live in Firebase, not here. Existing rows keep their (now unused) hash; new rows leave it NULL.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
