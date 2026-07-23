-- Map pin location for each school in the directory. Nullable: only pre-registered /
-- geocoded schools have a pin; others simply don't render one on the Heat Map.
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

