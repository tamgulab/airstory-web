import { pool } from "../db/pool.js";
import { firebaseAuth } from "../config/firebase-admin.js";

/**
 * Authenticate via a Firebase ID token (Authorization: Bearer <idToken>).
 * Verifies the token with Firebase Admin, then resolves it to the app user row by firebase_uid.
 * Sets req.user = { userId, email, firebaseUid } so downstream code keeps using the internal UUID.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const result = await pool.query(
      `SELECT id, email FROM users WHERE firebase_uid = $1`,
      [decoded.uid]
    );
    if (!result.rowCount) {
      // Authenticated with Firebase, but no app account exists yet — they must finish /auth/register.
      return res.status(401).json({ error: "No account for this user. Complete registration." });
    }
    req.user = {
      userId: result.rows[0].id,
      email: result.rows[0].email,
      firebaseUid: decoded.uid,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireWorkspaceRole(allowedRoles = []) {
  return async (req, res, next) => {
    const workspaceId = req.params.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    const membership = await pool.query(
      `SELECT role
       FROM workspace_memberships
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.userId]
    );

    if (!membership.rowCount) {
      return res.status(403).json({ error: "Not a workspace member" });
    }

    const role = membership.rows[0].role;
    req.workspaceRole = role;
    if (allowedRoles.length && !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }

    return next();
  };
}
