import express from "express";
import { stringify } from "csv-stringify/sync";
import { pool } from "../../db/pool.js";
import { requireAuth, requireWorkspaceRole } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { fetchOpenAQDailyReference, fetchOpenAQHeatmapPoints } from "../../services/openaq.js";

const router = express.Router();

router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/analytics/summary",
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const { metric = "pm25", from, to } = req.query;
    if (!["pm25", "co", "temp", "humidity"].includes(metric)) {
      return res.status(400).json({ error: "Invalid metric" });
    }
    const values = [workspaceId];
    const where = ["workspace_id = $1"];
    if (from) {
      values.push(from);
      where.push(`captured_at >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      where.push(`captured_at <= $${values.length}`);
    }
    const result = await pool.query(
      `SELECT
        AVG(${metric}) AS mean,
        MIN(${metric}) AS min,
        MAX(${metric}) AS max,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${metric}) AS median,
        STDDEV_POP(${metric}) AS stddev,
        COUNT(*) AS sample_count
      FROM measurements
      WHERE ${where.join(" AND ")}`,
      values
    );

    res.json({ metric, summary: result.rows[0] });
  }
);

router.get(
  "/workspaces/:workspaceId/heatmap",
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const { metric = "pm25" } = req.query;
    if (!["pm25", "co", "temp", "humidity"].includes(metric)) {
      return res.status(400).json({ error: "Invalid metric" });
    }
    const result = await pool.query(
      `SELECT
        ROUND(CAST(latitude AS numeric), 4) AS latitude,
        ROUND(CAST(longitude AS numeric), 4) AS longitude,
        AVG(${metric}) AS value,
        COUNT(*) AS point_count
      FROM measurements
      WHERE workspace_id = $1
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      GROUP BY 1, 2
      ORDER BY point_count DESC`,
      [workspaceId]
    );
    res.json({ metric, points: result.rows });
  }
);

router.get(
  "/workspaces/:workspaceId/export/measurements.csv",
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const result = await pool.query(
      `SELECT
        m.id, m.captured_at, m.pm25, m.co, m.temp, m.humidity, m.latitude, m.longitude, m.indoor_outdoor,
        s.session_code, s.name AS session_name, s.school_code, s.instructor, s.period, s.group_code
      FROM measurements m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.workspace_id = $1
      ORDER BY m.captured_at DESC`,
      [workspaceId]
    );

    const csv = stringify(result.rows, { header: true });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=measurements.csv");
    res.status(200).send(csv);
  }
);

/**
 * OpenAQ reference series (PM2.5 daily averages near a lat/lng).
 * Key stays server-side; frontend calls with JWT.
 */
router.get("/analytics/openaq/daily", async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;
    const metric = req.query.metric || "pm25";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng query params are required" });
    }
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: "date_from and date_to are required (YYYY-MM-DD)" });
    }

    const result = await fetchOpenAQDailyReference({
      apiKey: env.openaqApiKey,
      lat,
      lng,
      dateFrom,
      dateTo,
      metric,
    });

    if (result.error === "no_api_key") {
      return res.status(503).json(result);
    }
    if (result.error === "unsupported_metric") {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/openaq/heatmap", async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const metric = req.query.metric || "pm25";
    const radius = Number(req.query.radius || 15000);
    const limit = Number(req.query.limit || 25);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng query params are required" });
    }

    const result = await fetchOpenAQHeatmapPoints({
      apiKey: env.openaqApiKey,
      lat,
      lng,
      metric,
      radius,
      limit,
    });

    if (result.error === "no_api_key") return res.status(503).json(result);
    if (result.error === "unsupported_metric") return res.status(400).json(result);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
