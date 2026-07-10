-- Internal directory of schools that teachers pick from in account settings.
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Starter directory; re-running is safe (names are unique).
INSERT INTO schools (name) VALUES
  ('Lincoln High School'),
  ('Washington High School'),
  ('Jefferson High School'),
  ('Roosevelt High School'),
  ('Kennedy High School'),
  ('Franklin High School'),
  ('Madison High School'),
  ('Hamilton High School'),
  ('Adams High School'),
  ('Monroe High School'),
  ('Riverside High School'),
  ('Oakwood High School'),
  ('Maplewood High School'),
  ('Greenfield High School'),
  ('Springfield High School')
ON CONFLICT (name) DO NOTHING;
