import { pool } from "./pool.js";

await pool.query(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO anon;
  GRANT ALL ON SCHEMA public TO authenticated;
  GRANT ALL ON SCHEMA public TO service_role;
`);

console.log("Database wiped.");
await pool.end();
