-- Located school catalog for the three AirStory program cities.
-- Neighborhood/district metadata is intentionally omitted; class assignment only needs the
-- canonical school row and its map coordinates.
-- Earlier development builds used two city-center placeholders. Keep any referenced rows intact,
-- but remove them from the located picker now that real schools are available.
UPDATE schools
SET latitude = NULL, longitude = NULL
WHERE name IN ('New York City Program School', 'Hanoi Program School');

INSERT INTO schools (name, latitude, longitude) VALUES
  -- Philadelphia
  ('Philadelphia High School for Girls', 40.0383, -75.1461),
  ('Central High School', 40.0361, -75.1472),
  ('Abraham Lincoln High School', 40.0401, -75.0312),
  ('Benjamin Franklin High School', 39.9634, -75.1610),
  ('George Washington High School', 40.1132, -75.0345),

  -- New York City
  ('Stuyvesant High School', 40.7178, -74.0139),
  ('Brooklyn Technical High School', 40.6888, -73.9765),
  ('Bronx High School of Science', 40.8778, -73.8911),
  ('Townsend Harris High School', 40.7350, -73.8164),
  ('Fiorello H. LaGuardia High School', 40.7741, -73.9840),

  -- Hanoi
  ('Chu Văn An High School', 21.0433, 105.8334),
  ('Hà Nội - Amsterdam High School', 21.0067, 105.7981),
  ('Phan Đình Phùng High School', 21.0402, 105.8431),
  ('Foreign Language Specialized School', 21.0378, 105.7811),
  ('High School for Gifted Students (HUS)', 21.0039, 105.8078)
ON CONFLICT (name) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Aggregate school workspaces were originally created before these catalog rows existed.
-- Add the matching read-only workspace for each new school, without affecting class workspaces.
INSERT INTO workspaces (name, kind, school_id)
SELECT schools.name, 'school', schools.id
FROM schools
WHERE schools.name IN (
  'Philadelphia High School for Girls',
  'Central High School',
  'Abraham Lincoln High School',
  'Benjamin Franklin High School',
  'George Washington High School',
  'Stuyvesant High School',
  'Brooklyn Technical High School',
  'Bronx High School of Science',
  'Townsend Harris High School',
  'Fiorello H. LaGuardia High School',
  'Chu Văn An High School',
  'Hà Nội - Amsterdam High School',
  'Phan Đình Phùng High School',
  'Foreign Language Specialized School',
  'High School for Gifted Students (HUS)'
)
ON CONFLICT DO NOTHING;
