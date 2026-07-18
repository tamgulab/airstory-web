import express from "express";
import { pool } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

// Located school directory used by the account-settings picker. Only schools that can be shown
// accurately on the map are selectable. Optional ?q= filters by name (case-insensitive substring).
router.get("/schools", requireAuth, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const result = q
      ? await pool.query(
          `SELECT id, name, latitude, longitude
           FROM schools
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND name ILIKE $1
           ORDER BY name
           LIMIT 50`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, name, latitude, longitude
           FROM schools
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL
           ORDER BY name`
        );
    res.json({ schools: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
