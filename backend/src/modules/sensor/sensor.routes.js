import express from "express";
import { pool } from "../../db/pool.js";
import { requireAuth, requireWorkspaceRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addMeasurementEditSchema,
  createMeasurementSchema,
  createSessionSchema,
  importCsvMeasurementsSchema,
  updateMeasurementSchema,
} from "./sensor.schemas.js";

const router = express.Router();

/**Runs on every request that reaches this router before handler */
router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/sessions",
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const result = await pool.query(
      `SELECT * FROM sessions
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    res.json({ sessions: result.rows });
  }
);

router.post(
  "/workspaces/:workspaceId/sessions",
  requireWorkspaceRole(["teacher"]),
  validate(createSessionSchema),
  async (req, res) => {
    const { workspaceId } = req.params;
    const body = req.validated.body;
    const result = await pool.query(
      `INSERT INTO sessions (
        workspace_id, created_by, session_code, name, notes,
        location_name, school_code, instructor, period, group_code,
        started_at, ended_at, visibility, owner_student_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *`,
      [
        workspaceId,
        req.user.userId,
        body.sessionCode,
        body.name,
        body.notes,
        body.locationName,
        body.schoolCode,
        body.instructor,
        body.period,
        body.groupCode,
        body.startedAt || null,
        body.endedAt || null,
        body.visibility,
        body.ownerCode || '',
      ]
    );
    res.status(201).json({ session: result.rows[0] });
  }
);

router.delete(
  "/workspaces/:workspaceId/sessions/:sessionId",
  requireWorkspaceRole(["teacher"]),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { workspaceId, sessionId } = req.params;
      await client.query("BEGIN");
      const result = await client.query(
        `DELETE FROM sessions
         WHERE workspace_id = $1 AND id = $2
         RETURNING id`,
        [workspaceId, sessionId]
      );
      await client.query("COMMIT");
      if (!result.rowCount) {
        return res.status(404).json({ error: "Session not found" });
      }
      return res.status(204).send();
    } catch (err) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release();
    }
  }
);

router.get(
  "/workspaces/:workspaceId/measurements",
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const {
      from,
      to,
      sessionId,
      schoolCode,
      instructor,
      groupCode,
      limit = 200,
      offset = 0,
    } = req.query;

    const values = [workspaceId];
    const clauses = ["m.workspace_id = $1"];

    if (from) {
      values.push(from);
      clauses.push(`m.captured_at >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      clauses.push(`m.captured_at <= $${values.length}`);
    }
    if (sessionId) {
      values.push(sessionId);
      clauses.push(`m.session_id = $${values.length}`);
    }
    if (schoolCode) {
      values.push(schoolCode);
      clauses.push(`s.school_code = $${values.length}`);
    }
    if (instructor) {
      values.push(instructor);
      clauses.push(`s.instructor = $${values.length}`);
    }
    if (groupCode) {
      values.push(groupCode);
      clauses.push(`s.group_code = $${values.length}`);
    }

    values.push(Number(limit));
    const limitPos = values.length;
    values.push(Number(offset));
    const offsetPos = values.length;

    const query = `
      SELECT
        m.*,
        s.session_code,
        s.name AS session_name,
        s.notes AS session_notes,
        s.location_name,
        s.school_code,
        s.instructor,
        s.period,
        s.group_code,
        s.visibility,
        s.owner_student_code,
        COALESCE(ed.latest_edits, '{}'::jsonb) AS edits
      FROM measurements m
      JOIN sessions s ON s.id = m.session_id
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(t.field_name, t.payload) AS latest_edits
        FROM (
          SELECT DISTINCT ON (e.field_name)
            e.field_name,
            jsonb_build_object(
              'editedValue', e.edited_value,
              'originalValue', e.original_value,
              'editedByUserId', e.edited_by_user_id,
              'editNote', e.edit_note,
              'createdAt', e.created_at
            ) AS payload
          FROM measurement_edits e
          WHERE e.measurement_id = m.id
          ORDER BY e.field_name, e.created_at DESC
        ) t
      ) ed ON TRUE
      WHERE ${clauses.join(" AND ")}
      ORDER BY m.captured_at DESC
      LIMIT $${limitPos} OFFSET $${offsetPos}
    `;
    const result = await pool.query(query, values);
    res.json({ measurements: result.rows });
  }
);

router.post(
  "/workspaces/:workspaceId/import/csv",
  requireWorkspaceRole(["teacher", "student"]),
  validate(importCsvMeasurementsSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { workspaceId } = req.params;
      const rows = req.validated.body.rows || [];
      const sessionCache = new Map();

      await client.query("BEGIN");

      for (const row of rows) {
        const sessionCode = row.sessionCode || "SESSION";
        const sessionKey = [
          sessionCode,
          row.school || "",
          row.instructor || "",
          row.period || "",
          row.group || "",
          row.location || "",
        ].join("|");

        let sessionId = sessionCache.get(sessionKey);
        if (!sessionId) {
          const existing = await client.query(
            `SELECT id
             FROM sessions
             WHERE workspace_id = $1
               AND session_code = $2
               AND COALESCE(school_code, '') = $3
               AND COALESCE(instructor, '') = $4
               AND COALESCE(period, '') = $5
               AND COALESCE(group_code, '') = $6
             ORDER BY created_at DESC
             LIMIT 1`,
            [workspaceId, sessionCode, row.school || "", row.instructor || "", row.period || "", row.group || ""]
          );

          if (existing.rowCount) {
            sessionId = existing.rows[0].id;
          } else {
            const created = await client.query(
              `INSERT INTO sessions (
                workspace_id, created_by, session_code, name, notes, location_name,
                school_code, instructor, period, group_code, visibility, owner_student_code
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
              RETURNING id`,
              [
                workspaceId,
                req.user.userId,
                sessionCode,
                row.sessionName || "Imported Session",
                row.sessionNotes || "",
                row.location || "",
                row.school || "",
                row.instructor || "",
                row.period || "",
                row.group || "",
                row.visibility,
                row.ownerCode || '',
              ]
            );
            sessionId = created.rows[0].id;
          }
          sessionCache.set(sessionKey, sessionId);
        }

        await client.query(
          `INSERT INTO measurements (
            workspace_id, session_id, captured_at, latitude, longitude, indoor_outdoor,
            pm25, co, temp, humidity
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            workspaceId,
            sessionId,
            row.capturedAt,
            row.latitude ?? null,
            row.longitude ?? null,
            row.indoorOutdoor || null,
            row.pm25,
            row.co,
            row.temp,
            row.humidity,
          ]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ importedCount: rows.length });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/workspaces/:workspaceId/measurements",
  requireWorkspaceRole(["teacher"]),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { workspaceId } = req.params;
      await client.query("BEGIN");
      await client.query(`DELETE FROM measurement_edits WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM measurements WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM sessions WHERE workspace_id = $1`, [workspaceId]);
      await client.query("COMMIT");
      res.status(204).send();
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  }
);

router.post(
  "/workspaces/:workspaceId/measurements",
  requireWorkspaceRole(["teacher"]),
  validate(createMeasurementSchema),
  async (req, res) => {
    const { workspaceId } = req.params;
    const body = req.validated.body;
    const result = await pool.query(
      `INSERT INTO measurements (
        workspace_id, session_id, captured_at, latitude, longitude, indoor_outdoor,
        pm25, co, temp, humidity
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      RETURNING *`,
      [
        workspaceId,
        body.sessionId,
        body.capturedAt,
        body.latitude || null,
        body.longitude || null,
        body.indoorOutdoor || null,
        body.pm25,
        body.co,
        body.temp,
        body.humidity,
      ]
    );
    res.status(201).json({ measurement: result.rows[0] });
  }
);

router.patch(
  "/workspaces/:workspaceId/measurements/:measurementId",
  requireWorkspaceRole(["teacher"]),
  validate(updateMeasurementSchema),
  async (req, res) => {
    const { measurementId, workspaceId } = req.params;
    const fields = req.validated.body;

    const sets = [];
    const values = [workspaceId, measurementId];
    for (const [key, value] of Object.entries(fields)) {
      values.push(value);
      const col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      sets.push(`${col} = $${values.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "No fields to update" });

    const query = `
      UPDATE measurements
      SET ${sets.join(", ")}
      WHERE workspace_id = $1 AND id = $2
      RETURNING *
    `;
    const result = await pool.query(query, values);
    if (!result.rowCount) return res.status(404).json({ error: "Measurement not found" });
    res.json({ measurement: result.rows[0] });
  }
);

router.post(
  "/workspaces/:workspaceId/measurements/:measurementId/edits",
  requireWorkspaceRole(["teacher", "student"]),
  validate(addMeasurementEditSchema),
  async (req, res) => {
    const { workspaceId, measurementId } = req.params;
    const { fieldName, editedValue, editNote } = req.validated.body;

    const current = await pool.query(
      `SELECT id, ${fieldName} AS original_value
       FROM measurements
       WHERE id = $1 AND workspace_id = $2`,
      [measurementId, workspaceId]
    );
    if (!current.rowCount) return res.status(404).json({ error: "Measurement not found" });

    const originalValue = Number(current.rows[0].original_value);
    const result = await pool.query(
      `INSERT INTO measurement_edits (
        workspace_id, measurement_id, edited_by_user_id, field_name, original_value, edited_value, edit_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [workspaceId, measurementId, req.user.userId, fieldName, originalValue, editedValue, editNote || ""]
    );

    res.status(201).json({ edit: result.rows[0] });
  }
);

export default router;
