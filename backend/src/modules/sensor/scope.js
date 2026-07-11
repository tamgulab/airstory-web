import { pool } from "../../db/pool.js";

/** Look up a workspace's kind + school so reads can scope correctly. Returns null if missing. */
export async function resolveWorkspaceScope(workspaceId) {
  const res = await pool.query(`SELECT kind, school_id FROM workspaces WHERE id = $1`, [workspaceId]);
  if (!res.rowCount) return null;
  return { kind: res.rows[0].kind, schoolId: res.rows[0].school_id };
}

/**
 * Build the JOIN + WHERE that scope a query over `sessions <alias>` to what a viewer of the target
 * workspace may see, based on its kind. Bind values are pushed onto `values`; returns SQL fragments
 * to splice in.
 *
 *  - class : data physically stored in this workspace.
 *  - school: every session whose class belongs to this school, flagged public or school.
 *  - public: every session flagged public.
 */
export function buildScopedDataFilter(scope, workspaceId, values, sessionAlias = "s") {
  const s = sessionAlias;
  if (scope.kind === "school") {
    values.push(scope.schoolId);
    return {
      joinSql: `JOIN workspaces cw ON cw.id = ${s}.workspace_id`,
      whereClauses: [`cw.school_id = $${values.length}`, `${s}.visibility IN ('public','school')`],
    };
  }
  if (scope.kind === "public") {
    return { joinSql: "", whereClauses: [`${s}.visibility = 'public'`] };
  }
  values.push(workspaceId);
  return { joinSql: "", whereClauses: [`${s}.workspace_id = $${values.length}`] };
}
