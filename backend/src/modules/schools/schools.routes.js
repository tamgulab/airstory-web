import express from "express";
import { pool } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

// Internal school directory used by the account-settings school picker.
// Optional ?q= filters by name (case-insensitive substring); otherwise returns the full list.
router.get("/schools", requireAuth, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const result = q
      ? await pool.query(
          `SELECT id, name FROM schools WHERE name ILIKE $1 ORDER BY name LIMIT 50`,
          [`%${q}%`]
        )
      : await pool.query(`SELECT id, name FROM schools ORDER BY name`);
    res.json({ schools: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
