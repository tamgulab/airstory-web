/**
 * Reference data: rows the app requires in every environment, in every database.
 *
 * Unlike seed.js (demo data, dev only), this runs on every boot ahead of the server.
 * It is idempotent, so re-running is a no-op, and it never deletes: a school removed
 * from SCHOOLS below stays in the database, because classes may already point at it
 * and workspaces.school_id cascades on delete.
 *
 * To add a school: add a row to SCHOOLS, then deploy. Name is the key, so editing a
 * name adds a school rather than renaming one - remove the old row by hand if needed.
 */
import { pool } from "./pool.js";

// Only schools with coordinates are selectable in the account-settings picker
// (see modules/schools/schools.routes.js), since each one gets a Heat Map pin.
export const SCHOOLS = [
  // Philadelphia
  { name: "Philadelphia High School for Girls", latitude: 40.0383, longitude: -75.1461 },
  { name: "Central High School", latitude: 40.0361, longitude: -75.1472 },
  { name: "Abraham Lincoln High School", latitude: 40.0401, longitude: -75.0312 },
  { name: "Benjamin Franklin High School", latitude: 39.9634, longitude: -75.1610 },
  { name: "George Washington High School", latitude: 40.1132, longitude: -75.0345 },

  // New York City
  { name: "Stuyvesant High School", latitude: 40.7178, longitude: -74.0139 },
  { name: "Brooklyn Technical High School", latitude: 40.6888, longitude: -73.9765 },
  { name: "Bronx High School of Science", latitude: 40.8778, longitude: -73.8911 },
  { name: "Townsend Harris High School", latitude: 40.7350, longitude: -73.8164 },
  { name: "Fiorello H. LaGuardia High School", latitude: 40.7741, longitude: -73.9840 },

  // Hanoi
  { name: "Chu Văn An High School", latitude: 21.0433, longitude: 105.8334 },
  { name: "Hà Nội - Amsterdam High School", latitude: 21.0067, longitude: 105.7981 },
  { name: "Phan Đình Phùng High School", latitude: 21.0402, longitude: 105.8431 },
  { name: "Foreign Language Specialized School", latitude: 21.0378, longitude: 105.7811 },
  { name: "High School for Gifted Students (HUS)", latitude: 21.0039, longitude: 105.8078 },
];

/**
 * Create the reference rows if they are missing, and update coordinates in place.
 * Idempotent; pass a transaction client to run alongside other work.
 */
export async function ensureReferenceData(client) {
  // The singleton Public workspace. Every account joins it (see modules/auth/memberships.js),
  // which silently does nothing if this row is absent - so it must exist before serving.
  await client.query(
    `INSERT INTO workspaces (name, kind)
     SELECT 'Public', 'public'
     WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE kind = 'public')`
  );

  for (const school of SCHOOLS) {
    const result = await client.query(
      `INSERT INTO schools (name, latitude, longitude)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE
         SET latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude
       RETURNING id`,
      [school.name, school.latitude, school.longitude]
    );

    // Each school's read-only aggregate workspace.
    // uniq_workspace_per_school keeps this to one per school.
    await client.query(
      `INSERT INTO workspaces (name, kind, school_id)
       VALUES ($1, 'school', $2)
       ON CONFLICT DO NOTHING`,
      [school.name, result.rows[0].id]
    );
  }
}

// Run directly (npm run db:reference, and the start / db:reset chains).
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await ensureReferenceData(pool);
    console.log(`Reference data ready: ${SCHOOLS.length} schools.`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
