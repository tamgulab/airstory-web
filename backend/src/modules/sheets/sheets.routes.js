import express from "express";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { requireAuth, requireWorkspaceRole } from "../../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

async function buildSheetsClient() {
  if (!env.googleServiceAccountEmail || !env.googlePrivateKey || !env.googleSheetId) {
    throw new Error("Google Sheets env vars are missing");
  }
  const auth = new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

router.post(
  "/workspaces/:workspaceId/sheets/export",
  requireWorkspaceRole(["teacher"]),
  async (req, res, next) => {
    try {
      const { workspaceId } = req.params;
      const sheets = await buildSheetsClient();

      const sessions = await pool.query(
        `SELECT id, session_code, name, notes, location_name, school_code, instructor, period, group_code, created_at
         FROM sessions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 5000`,
        [workspaceId]
      );
      const measurements = await pool.query(
        `SELECT id, session_id, captured_at, pm25, co, temp, humidity, latitude, longitude, indoor_outdoor
         FROM measurements WHERE workspace_id = $1 ORDER BY captured_at DESC LIMIT 5000`,
        [workspaceId]
      );

      const sessionRows = [
        [
          "id",
          "session_code",
          "name",
          "notes",
          "location_name",
          "school_code",
          "instructor",
          "period",
          "group_code",
          "created_at",
        ],
        ...sessions.rows.map((r) => Object.values(r)),
      ];
      const measurementRows = [
        [
          "id",
          "session_id",
          "captured_at",
          "pm25",
          "co",
          "temp",
          "humidity",
          "latitude",
          "longitude",
          "indoor_outdoor",
        ],
        ...measurements.rows.map((r) => Object.values(r)),
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: env.googleSheetId,
        range: "sessions!A1",
        valueInputOption: "RAW",
        requestBody: { values: sessionRows },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.googleSheetId,
        range: "measurements!A1",
        valueInputOption: "RAW",
        requestBody: { values: measurementRows },
      });

      res.json({
        ok: true,
        exported: {
          sessions: sessions.rowCount,
          measurements: measurements.rowCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
