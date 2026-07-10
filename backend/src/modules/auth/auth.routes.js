import crypto from "node:crypto";
import express from "express";
import { pool } from "../../db/pool.js";
import { requireAuth, requireWorkspaceRole } from "../../middleware/auth.js";
import { firebaseAuth } from "../../config/firebase-admin.js";
import { validate } from "../../middleware/validate.js";
import {
  createInvitationsSchema,
  inviteTokenSchema,
  removeStudentSchema,
  registerSchema,
  resetStudentPasswordSchema,
  revokeInvitationSchema,
  updateClassStructureSchema,
  updateMyProfileSchema,
  updateStudentPlacementSchema,
} from "./auth.schemas.js";

const router = express.Router();

const makeInviteToken = () => crypto.randomBytes(32).toString("base64url");

// Short display identifier used to mark ownership of data sessions (owner_student_code).
const deriveStudentCode = (email, role) =>
  role === "student" ? String(email).split("@")[0].toUpperCase() : "";

/**
 * Fetch an invitation by token and classify unusable states.
 * Returns { invite } when pending and unexpired, else { status, error } for the HTTP response.
 */
async function loadInviteByToken(client, token, { forUpdate = false } = {}) {
  const result = await client.query(
    `SELECT i.*, w.name AS workspace_name, u.full_name AS invited_by_name
     FROM invitations i
     JOIN workspaces w ON w.id = i.workspace_id
     LEFT JOIN users u ON u.id = i.invited_by
     WHERE i.token = $1
     ${forUpdate ? "FOR UPDATE OF i" : ""}`,
    [token]
  );
  if (!result.rowCount) return { status: 404, error: "Invitation not found" };
  const invite = result.rows[0];
  if (invite.status === "revoked") return { status: 410, error: "This invitation was revoked." };
  if (invite.status === "accepted") return { status: 410, error: "This invitation has already been used." };
  if (new Date(invite.expires_at) <= new Date()) return { status: 410, error: "This invitation has expired." };
  return { invite };
}

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
    const { email, fullName, workspaceName, inviteToken } = req.validated.body;
    // The verified token email is the source of truth for identity; fall back to the posted email.
    const accountEmail = String(decoded.email || email).trim().toLowerCase();

    await client.query("BEGIN");

    // Reject duplicate provisioning so a second /register can't fork a user's workspace.
    const existing = await client.query(`SELECT 1 FROM users WHERE firebase_uid = $1`, [firebaseUid]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Account already registered" });
    }

    // Resolve the invitation before creating anything so a bad token leaves no orphan user row.
    let invite = null;
    if (inviteToken) {
      const lookup = await loadInviteByToken(client, inviteToken, { forUpdate: true });
      if (!lookup.invite) {
        await client.query("ROLLBACK");
        return res.status(lookup.status).json({ error: lookup.error });
      }
      invite = lookup.invite;
      if (invite.email !== accountEmail) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: `This invitation was sent to ${invite.email}; you are signed in as ${accountEmail}.`,
        });
      }
    }

    const userResult = await client.query(
      `INSERT INTO users (email, firebase_uid, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [accountEmail, firebaseUid, fullName]
    );
    const user = userResult.rows[0];

    let workspaceId;
    let membershipRole;
    if (invite) {
      workspaceId = invite.workspace_id;
      membershipRole = invite.role;
    } else {
      const wsResult = await client.query(
        `INSERT INTO workspaces (name, created_by)
         VALUES ($1, $2)
         RETURNING id`,
        [workspaceName, user.id]
      );
      workspaceId = wsResult.rows[0].id;
      // Creating a workspace makes you its teacher; students only ever arrive by invitation.
      membershipRole = "teacher";
    }

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
        "",
        "",
        invite?.period || "",
        invite?.group_code || "",
        deriveStudentCode(accountEmail, membershipRole),
      ]
    );

    if (invite) {
      await client.query(
        `UPDATE invitations
         SET status = 'accepted', accepted_at = NOW(), accepted_by_user_id = $1
         WHERE id = $2`,
        [user.id, invite.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...makeUserResponse(user, workspaceId), role: membershipRole });
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
  // One membership per workspace, each with its own profile. The client picks the
  // "current" workspace; the server has no notion of a selected workspace.
  const membershipResult = await pool.query(
    `SELECT wm.workspace_id, w.name AS workspace_name, wm.role,
            up.school_code, up.instructor, up.period, up.group_code, up.student_code
     FROM workspace_memberships wm
     JOIN workspaces w ON w.id = wm.workspace_id
     LEFT JOIN user_profiles up ON up.user_id = wm.user_id AND up.workspace_id = wm.workspace_id
     WHERE wm.user_id = $1
     ORDER BY w.created_at`,
    [req.user.userId]
  );
  const memberships = membershipResult.rows.map((row) => ({
    workspace_id: row.workspace_id,
    workspace_name: row.workspace_name,
    role: row.role,
    profile: {
      workspace_id: row.workspace_id,
      school_code: row.school_code || "",
      instructor: row.instructor || "",
      period: row.period || "",
      group_code: row.group_code || "",
      student_code: row.student_code || "",
    },
  }));
  res.json({
    user: userResult.rows[0],
    memberships,
  });
});

router.patch("/me/profile", requireAuth, validate(updateMyProfileSchema), async (req, res, next) => {
  try {
    const body = req.validated.body;
    const existing = await pool.query(
      `SELECT workspace_id, school_code, instructor, period, group_code
       FROM user_profiles
       WHERE user_id = $1 AND workspace_id = $2`,
      [req.user.userId, body.workspaceId]
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
       SET school_code = $1, instructor = $2, period = $3, group_code = $4, updated_at = NOW()
       WHERE user_id = $5 AND workspace_id = $6
       RETURNING workspace_id, school_code, instructor, period, group_code, student_code`,
      [schoolCode, instructor, period, groupCode, req.user.userId, body.workspaceId]
    );
    res.json({ profile: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Unauthenticated: the /join/<token> landing page shows what the invitee is joining
// before they have an account.
router.get("/invitations/:token", validate(inviteTokenSchema), async (req, res) => {
  const lookup = await loadInviteByToken(pool, req.validated.params.token);
  if (!lookup.invite) return res.status(lookup.status).json({ error: lookup.error });
  const invite = lookup.invite;
  res.json({
    workspaceId: invite.workspace_id,
    workspaceName: invite.workspace_name,
    email: invite.email,
    role: invite.role,
    period: invite.period || "",
    invitedBy: invite.invited_by_name || "",
    expiresAt: invite.expires_at,
  });
});

// Signed-in user accepts an invitation into an additional workspace.
router.post(
  "/invitations/:token/accept",
  requireAuth,
  validate(inviteTokenSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lookup = await loadInviteByToken(client, req.validated.params.token, { forUpdate: true });
      if (!lookup.invite) {
        await client.query("ROLLBACK");
        return res.status(lookup.status).json({ error: lookup.error });
      }
      const invite = lookup.invite;
      if (invite.email !== req.user.email) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: `This invitation was sent to ${invite.email}; you are signed in as ${req.user.email}.`,
        });
      }

      const workspace = { id: invite.workspace_id, name: invite.workspace_name };
      const membership = await client.query(
        `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`,
        [invite.workspace_id, req.user.userId]
      );
      if (membership.rowCount) {
        // Idempotent: retire the invite and report the existing membership.
        await client.query(
          `UPDATE invitations
           SET status = 'accepted', accepted_at = NOW(), accepted_by_user_id = $1
           WHERE id = $2`,
          [req.user.userId, invite.id]
        );
        await client.query("COMMIT");
        return res.status(200).json({
          alreadyMember: true,
          workspace,
          membership: { workspace_id: invite.workspace_id, role: membership.rows[0].role },
        });
      }

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [invite.workspace_id, req.user.userId, invite.role]
      );
      await client.query(
        `INSERT INTO user_profiles (
          user_id, workspace_id, school_code, instructor, period, group_code, student_code
        ) VALUES ($1, $2, '', '', $3, $4, $5)`,
        [
          req.user.userId,
          invite.workspace_id,
          invite.period || "",
          invite.group_code || "",
          deriveStudentCode(req.user.email, invite.role),
        ]
      );
      await client.query(
        `UPDATE invitations
         SET status = 'accepted', accepted_at = NOW(), accepted_by_user_id = $1
         WHERE id = $2`,
        [req.user.userId, invite.id]
      );
      await client.query("COMMIT");
      res.status(201).json({
        workspace,
        membership: { workspace_id: invite.workspace_id, role: invite.role },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
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
    LEFT JOIN user_profiles up ON up.user_id = wm.user_id AND up.workspace_id = wm.workspace_id
    WHERE wm.workspace_id = $1
    ORDER BY wm.role DESC, up.period, up.group_code, u.full_name`,
    [workspaceId]
  );

  res.json({ members: roster.rows });
});

router.get(
  "/workspaces/:workspaceId/invitations",
  requireAuth,
  requireWorkspaceRole(["teacher"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    // Token is included so teachers can re-copy pending invite links; the route is teacher-gated.
    const result = await pool.query(
      `SELECT i.id, i.email, i.role, i.period, i.group_code, i.token, i.status,
              i.created_at, i.expires_at, i.accepted_at,
              u.full_name AS invited_by_name
       FROM invitations i
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.workspace_id = $1
       ORDER BY i.created_at DESC`,
      [workspaceId]
    );
    res.json({ invitations: result.rows });
  }
);

router.get(
  "/workspaces/:workspaceId/class-structure",
  requireAuth,
  requireWorkspaceRole(["teacher", "student"]),
  async (req, res) => {
    const { workspaceId } = req.params;
    const structure = await getWorkspaceStructure(workspaceId);
    res.json(structure);
  }
);

router.patch(
  "/workspaces/:workspaceId/class-structure",
  requireAuth,
  requireWorkspaceRole(["teacher"]),
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
  "/workspaces/:workspaceId/invitations",
  requireAuth,
  requireWorkspaceRole(["teacher"]),
  validate(createInvitationsSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { workspaceId } = req.params;
      const { emails, role, period } = req.validated.body;
      const uniqueEmails = [...new Set(emails)];
      const invitations = [];
      const skipped = [];

      await client.query("BEGIN");
      for (const email of uniqueEmails) {
        const member = await client.query(
          `SELECT 1
           FROM workspace_memberships wm
           JOIN users u ON u.id = wm.user_id
           WHERE wm.workspace_id = $1 AND u.email = $2`,
          [workspaceId, email]
        );
        if (member.rowCount) {
          skipped.push({ email, reason: "already_member" });
          continue;
        }
        // Re-inviting a pending email regenerates the token and expiry (old link dies).
        const created = await client.query(
          `INSERT INTO invitations (workspace_id, email, role, token, invited_by, period)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (workspace_id, email) WHERE status = 'pending'
           DO UPDATE SET role = EXCLUDED.role, token = EXCLUDED.token, period = EXCLUDED.period,
                         invited_by = EXCLUDED.invited_by, created_at = NOW(),
                         expires_at = NOW() + INTERVAL '14 days'
           RETURNING id, email, role, period, group_code, token, status, created_at, expires_at`,
          [workspaceId, email, role, makeInviteToken(), req.user.userId, role === "student" ? period : ""]
        );
        invitations.push(created.rows[0]);
      }
      await client.query("COMMIT");
      // The client composes the shareable link (`${origin}/join/${token}`); the backend never builds URLs.
      res.status(201).json({ invitations, skipped });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/workspaces/:workspaceId/invitations/:invitationId",
  requireAuth,
  requireWorkspaceRole(["teacher"]),
  validate(revokeInvitationSchema),
  async (req, res) => {
    const { workspaceId, invitationId } = req.params;
    const result = await pool.query(
      `UPDATE invitations
       SET status = 'revoked'
       WHERE id = $1 AND workspace_id = $2 AND status = 'pending'`,
      [invitationId, workspaceId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Pending invitation not found" });
    res.status(204).send();
  }
);

router.post(
  "/workspaces/:workspaceId/users/:userId/reset-password",
  requireAuth,
  requireWorkspaceRole(["teacher"]),
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
  requireWorkspaceRole(["teacher"]),
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
  requireWorkspaceRole(["teacher"]),
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
