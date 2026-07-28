import { pool } from "./pool.js";

// Full wipe so an old/half-migrated schema can be rebuilt from migrations.
// Role grants are best-effort: Supabase has anon/authenticated/service_role;
// local Postgres usually only has the connecting role + PUBLIC.
await pool.query(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO PUBLIC;
`);

const optionalRoles = ["postgres", "anon", "authenticated", "service_role"];
for (const role of optionalRoles) {
  try {
    await pool.query(`GRANT ALL ON SCHEMA public TO ${role}`);
  } catch {
    // Role does not exist in this database (common for local Postgres).
  }
}

console.log("Database wiped.");
await pool.end();
