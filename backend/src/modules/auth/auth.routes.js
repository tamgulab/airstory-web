import express from "express";
import { pool } from "../../db/pool.js";
import { requireAuth, requireWorkspaceRole } from "../../middleware/auth.js";
import { firebaseAuth } from "../../config/firebase-admin.js";
import { validate } from "../../middleware/validate.js";
import {
  createJoinCodeSchema,
  getJoinCodeConfigSchema,
  removeStudentSchema,
  registerSchema,
  resetStudentPasswordSchema,
  toggleJoinCodeSchema,
  updateClassStructureSchema,
  updateMyProfileSchema,
  updateStudentPlacementSchema,
} from "./auth.schemas.js";

const router = express.Router();

function buildStructure(periodCount = 1, groupCount = 4) {
  const periods = Array.from({ length: Number(periodCount) || 1 }, (_, i) => `P${i + 1}`);
  const groups = Array.from({ length: Number(groupCount) || 4 }, (_, i) => `G${i + 1}`);
  const groupsByPeriod = Object.fromEntries(periods.map((p) => [p, groups]));
  return { periods, groupsByPeriod, periodCount: periods.length, groupCount: groups.length };
}

async function getWorkspaceStructure(workspaceId) {
  const result = await pool.query(
    `SELECT period_count, group_count FROM workspace_class_structures WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId]
  );
  if (!result.rowCount) return buildStructure(1, 4);
  return buildStructure(result.rows[0].period_count, result.rows[0].group_count);
}

function makeUserResponse(user, workspaceId) {
  // Identity/session is owned by Firebase on the client; the backend only returns the app profile.
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      workspaceId,
    },
  };
}

router.post("/register", validate(registerSchema), async (req, res, next) => {
  // The Firebase account is created on the client first; register provisions the matching app account.
  // Requires a valid Firebase ID token (the user is already signed in to Firebase).
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "Missing Firebase auth token" });
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: "Invalid Firebase auth token" });
  }
  const firebaseUid = decoded.uid;

  const client = await pool.connect();
  try {
    const {
      email,
      fullName,
      workspaceName,
      role,
      schoolCode,
      instructor,
      period,
      groupCode,
      studentCode,
      joinWorkspaceId,
    joinCode,
    } = req.validated.body;
    // The verified token email is the source of truth for identity; fall back to the posted email.
    const accountEmail = String(decoded.email || email).trim().toLowerCase();

    await client.query("BEGIN");

    // Reject duplicate provisioning so a second /register can't fork a user's workspace.
    const existing = await client.query(`SELECT 1 FROM users WHERE firebase_uid = $1`, [firebaseUid]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Account already registered" });
    }

    const userResult = await client.query(
      `INSERT INTO users (email, firebase_uid, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [accountEmail, firebaseUid, fullName]
    );
    const user = userResult.rows[0];

    let workspaceId = joinWorkspaceId;
    let profileSchoolCode = schoolCode || "";
    let profileInstructor = instructor || "";
    if (!workspaceId && role === "student") {
      if (!joinCode) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Student signup requires a teacher join code." });
      }
      if (joinCode) {
        const codeResult = await client.query(
          `SELECT workspace_id, school_code, instructor
           FROM join_codes
           WHERE UPPER(code) = UPPER($1) AND active = TRUE
           LIMIT 1`,
          [joinCode.trim()]
        );
        if (!codeResult.rowCount) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Invalid or inactive join code" });
        }
        workspaceId = codeResult.rows[0].workspace_id;
        profileSchoolCode = codeResult.rows[0].school_code || profileSchoolCode;
        profileInstructor = codeResult.rows[0].instructor || profileInstructor;
      } else {
        const existingWorkspace = await client.query(
          `SELECT id FROM workspaces WHERE name = $1 ORDER BY created_at ASC LIMIT 1`,
          [workspaceName]
        );
        if (existingWorkspace.rowCount) {
          workspaceId = existingWorkspace.rows[0].id;
        }
      }
    }
    let structure = buildStructure(1, 4);
    if (workspaceId) {
      structure = await getWorkspaceStructure(workspaceId);
    }
    if (role === "student") {
      if (!structure.periods.includes(period)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid period for this class setup." });
      }
      const groups = structure.groupsByPeriod[period] || [];
      if (!groups.includes(groupCode)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid group for selected period." });
      }
    }
    if (!workspaceId) {
      const wsResult = await client.query(
        `INSERT INTO workspaces (name, created_by)
         VALUES ($1, $2)
         RETURNING id`,
        [workspaceName, user.id]
      );
      workspaceId = wsResult.rows[0].id;
    }

    // Join-code and normal student signup must stay "student". Only the workspace creator
    // (teacher registration) becomes owner. joinWorkspaceId is for explicit invite flows.
    const membershipRole =
      role === "student"
        ? "student"
        : joinWorkspaceId
          ? role === "teacher"
            ? "teacher"
            : "student"
          : "owner";

    await client.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [workspaceId, user.id, membershipRole]
    );

    await client.query(
      `INSERT INTO user_profiles (
        user_id, workspace_id, school_code, instructor, period, group_code, student_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        workspaceId,
        profileSchoolCode,
        profileInstructor,
        period || "",
        groupCode || "",
        studentCode || "",
      ]
    );

    await client.query("COMMIT");
    res.status(201).json(makeUserResponse(user, workspaceId));
  } catch (error) {
    await client.query("ROLLBACK");
    if (String(error.message).includes("users_email_key")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    if (String(error.message).includes("users_firebase_uid_key")) {
      return res.status(409).json({ error: "Account already registered" });
    }
    return next(error);
  } finally {
    client.release();
  }
});

// Login, logout, session refresh, and password changes are handled entirely by the Firebase
// client SDK (signInWithEmailAndPassword / signOut / automatic token refresh / updatePassword).
// The backend no longer issues or refreshes tokens. Teacher-initiated student password resets
// remain server-side via the Admin SDK — see POST /workspaces/:workspaceId/users/:userId/reset-password.

router.get("/me", requireAuth, async (req, res) => {
  const userResult = await pool.query(
    `SELECT id, email, full_name FROM users WHERE id = $1`,
    [req.user.userId]
  );
  const wsResult = await pool.query(
    `SELECT workspace_id, role FROM workspace_memberships WHERE user_id = $1`,
    [req.user.userId]
  );
  const profileResult = await pool.query(
    `SELECT workspace_id, school_code, instructor, period, group_code, student_code
     FROM user_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [req.user.userId]
  );
  res.json({
    user: userResult.rows[0],
    memberships: wsResult.rows,
    profile: profileResult.rows[0] || null,
  });
});

router.patch("/me/profile", requireAuth, validate(updateMyProfileSchema), async (req, res, next) => {
  try {
    const body = req.validated.body;
    const existing = await pool.query(
      `SELECT workspace_id, school_code, instructor, period, group_code
       FROM user_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.userId]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const row = existing.rows[0];
    const schoolCode = body.schoolCode !== undefined ? body.schoolCode : row.school_code;
    const instructor = body.instructor !== undefined ? body.instructor : row.instructor;
    const period = body.period !== undefined ? body.period : row.period;
    const groupCode = body.groupCode !== undefined ? body.groupCode : row.group_code;

    const updated = await pool.query(
      `UPDATE user_profiles
       SET school_code = $1, instructor = $2, period = $3, group_code = $4
       WHERE user_id = $5 AND workspace_id = $6
       RETURNING workspace_id, school_code, instructor, period, group_code, student_code`,
      [schoolCode, instructor, period, groupCode, req.user.userId, row.workspace_id]
    );
    res.json({ profile: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/join-code/:code/config",
  validate(getJoinCodeConfigSchema),
  async (req, res) => {
    const { code } = req.params;
    const result = await pool.query(
      `SELECT workspace_id, school_code, instructor
       FROM join_codes
       WHERE UPPER(code) = UPPER($1) AND active = TRUE
       LIMIT 1`,
      [code.trim()]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Invalid or inactive join code" });
    const workspaceId = result.rows[0].workspace_id;
    const structure = await getWorkspaceStructure(workspaceId);
    res.json({
      workspaceId,
      schoolCode: result.rows[0].school_code || "",
      instructor: result.rows[0].instructor || "",
      ...structure,
    });
  }
);

router.get("/workspaces/:workspaceId/roster", requireAuth, async (req, res) => {
  const { workspaceId } = req.params;
  const membership = await pool.query(
    `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, req.user.userId]
  );
  if (!membership.rowCount) return res.status(403).json({ error: "Not a workspace member" });

  const roster = await pool.query(
    `SELECT
      u.id,
      u.full_name,
      u.email,
      wm.role,
      up.school_code,
      up.instructor,
      up.period,
      up.group_code,
      up.student_code
    FROM workspace_memberships wm
    JOIN users u ON u.id = wm.user_id
    LEFT JOIN user_profiles up ON up.user_id = wm.user_id
    WHERE wm.workspace_id = $1
    ORDER BY wm.role DESC, up.period, up.group_code, u.full_name`,
    [workspaceId]
  );

  res.json({ members: roster.rows });
});

router.get(
  "/workspaces/:workspaceId/join-codes",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const result = await pool.query(
      `SELECT id, code, school_code, instructor, active, created_at
       FROM join_codes
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    res.json({ joinCodes: result.rows });
  }
);

router.get(
  "/workspaces/:workspaceId/class-structure",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const structure = await getWorkspaceStructure(workspaceId);
    res.json(structure);
  }
);

router.patch(
  "/workspaces/:workspaceId/class-structure",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(updateClassStructureSchema),
  async (req, res) => {
    const { workspaceId } = req.params;
    const { periodCount, groupCount } = req.validated.body;
    await pool.query(
      `INSERT INTO workspace_class_structures (workspace_id, period_count, group_count, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (workspace_id)
       DO UPDATE SET
         period_count = EXCLUDED.period_count,
         group_count = EXCLUDED.group_count,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [workspaceId, periodCount, groupCount, req.user.userId]
    );
    const structure = await getWorkspaceStructure(workspaceId);
    res.json(structure);
  }
);

router.post(
  "/workspaces/:workspaceId/join-codes",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(createJoinCodeSchema),
  async (req, res, next) => {
    try {
      const { workspaceId } = req.params;
      const { code, schoolCode, instructor, active } = req.validated.body;
      const created = await pool.query(
        `INSERT INTO join_codes (workspace_id, created_by, code, school_code, instructor, active)
         VALUES ($1, $2, UPPER($3), $4, $5, $6)
         RETURNING id, code, school_code, instructor, active, created_at`,
        [workspaceId, req.user.userId, code.trim(), schoolCode || "", instructor || "", active]
      );
      res.status(201).json({ joinCode: created.rows[0] });
    } catch (error) {
      if (String(error.message).includes("join_codes_code_key")) {
        return res.status(409).json({ error: "Join code already exists" });
      }
      next(error);
    }
  }
);

router.patch(
  "/workspaces/:workspaceId/join-codes/:codeId",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(toggleJoinCodeSchema),
  async (req, res) => {
    const { workspaceId, codeId } = req.params;
    const { active } = req.validated.body;
    const result = await pool.query(
      `UPDATE join_codes
       SET active = $1
       WHERE id = $2 AND workspace_id = $3
       RETURNING id, code, school_code, instructor, active, created_at`,
      [active, codeId, workspaceId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Join code not found" });
    res.json({ joinCode: result.rows[0] });
  }
);

router.post(
  "/workspaces/:workspaceId/users/:userId/reset-password",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(resetStudentPasswordSchema),
  async (req, res) => {
    const { workspaceId, userId } = req.params;
    const { newPassword } = req.validated.body;

    const student = await pool.query(
      `SELECT u.firebase_uid
       FROM workspace_memberships wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND wm.user_id = $2 AND wm.role = 'student'`,
      [workspaceId, userId]
    );
    if (!student.rowCount) {
      return res.status(404).json({ error: "Student not found in this workspace" });
    }
    const firebaseUid = student.rows[0].firebase_uid;
    if (!firebaseUid) {
      return res.status(409).json({ error: "Student has no Firebase account" });
    }

    // Reset the password in Firebase; existing sessions stay valid until their ID token expires.
    await firebaseAuth().updateUser(firebaseUid, { password: newPassword });
    res.status(204).send();
  }
);

router.patch(
  "/workspaces/:workspaceId/users/:userId/placement",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(updateStudentPlacementSchema),
  async (req, res) => {
    const { workspaceId, userId } = req.params;
    const { period, groupCode } = req.validated.body;
    const student = await pool.query(
      `SELECT wm.user_id
       FROM workspace_memberships wm
       WHERE wm.workspace_id = $1 AND wm.user_id = $2 AND wm.role = 'student'`,
      [workspaceId, userId]
    );
    if (!student.rowCount) {
      return res.status(404).json({ error: "Student not found in this workspace" });
    }
    const updated = await pool.query(
      `UPDATE user_profiles
       SET period = $1, group_code = $2
       WHERE workspace_id = $3 AND user_id = $4
       RETURNING user_id, workspace_id, period, group_code`,
      [period, groupCode, workspaceId, userId]
    );
    if (!updated.rowCount) return res.status(404).json({ error: "Student profile not found" });
    res.json({ profile: updated.rows[0] });
  }
);

router.delete(
  "/workspaces/:workspaceId/users/:userId",
  requireAuth,
  requireWorkspaceRole(["owner", "teacher"]),
  validate(removeStudentSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { workspaceId, userId } = req.params;
      const student = await client.query(
        `SELECT wm.user_id
         FROM workspace_memberships wm
         WHERE wm.workspace_id = $1 AND wm.user_id = $2 AND wm.role = 'student'`,
        [workspaceId, userId]
      );
      if (!student.rowCount) {
        return res.status(404).json({ error: "Student not found in this workspace" });
      }

      await client.query("BEGIN");
      await client.query(`DELETE FROM user_profiles WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
      await client.query(`DELETE FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
      await client.query("COMMIT");
      res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

export default router;
