/**
 * Aggregate-workspace membership reconciliation.
 *
 * Every account is a member of the singleton Public workspace, and of the 'school' workspace for
 * each school any of their 'class' workspaces belongs to. Schools are derived from class
 * memberships — never stored on the user — so this recomputes the correct set of Public + school
 * memberships for one user and makes reality match it. Idempotent; always call inside a
 * transaction (pass the transaction client) alongside the change that triggered it.
 *
 * A paired user_profiles row is inserted for every membership because /me's LEFT JOIN, the roster,
 * and PATCH /me/profile all assume one exists per (user, workspace).
 */
export async function reconcileAggregateMemberships(client, userId) {
  // 1. Ensure Public membership (+ empty profile).
  const publicWs = await client.query(`SELECT id FROM workspaces WHERE kind = 'public' LIMIT 1`);
  if (publicWs.rowCount) {
    await joinWorkspace(client, publicWs.rows[0].id, userId);
  }

  // 2. Schools this user actually belongs to, via their class workspaces.
  const targets = await client.query(
    `SELECT DISTINCT w.school_id
     FROM workspace_memberships m
     JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.user_id = $1 AND w.kind = 'class' AND w.school_id IS NOT NULL`,
    [userId]
  );
  const targetSchoolIds = targets.rows.map((r) => r.school_id);

  // 3. Ensure membership in each target school's workspace.
  for (const schoolId of targetSchoolIds) {
    const schoolWs = await client.query(
      `SELECT id FROM workspaces WHERE kind = 'school' AND school_id = $1 LIMIT 1`,
      [schoolId]
    );
    if (schoolWs.rowCount) {
      await joinWorkspace(client, schoolWs.rows[0].id, userId);
    }
  }

  // 4. Prune school memberships no longer backed by a current class.
  await client.query(
    `DELETE FROM user_profiles up
     USING workspaces w
     WHERE up.workspace_id = w.id
       AND up.user_id = $1
       AND w.kind = 'school'
       AND ($2::uuid[] IS NULL OR w.school_id <> ALL ($2::uuid[]))`,
    [userId, targetSchoolIds.length ? targetSchoolIds : null]
  );
  await client.query(
    `DELETE FROM workspace_memberships m
     USING workspaces w
     WHERE m.workspace_id = w.id
       AND m.user_id = $1
       AND w.kind = 'school'
       AND ($2::uuid[] IS NULL OR w.school_id <> ALL ($2::uuid[]))`,
    [userId, targetSchoolIds.length ? targetSchoolIds : null]
  );
}

/** Insert a membership + empty profile for (workspace, user); no-op if already present. */
async function joinWorkspace(client, workspaceId, userId) {
  await client.query(
    `INSERT INTO workspace_memberships (workspace_id, user_id, role)
     VALUES ($1, $2, 'student')
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [workspaceId, userId]
  );
  await client.query(
    `INSERT INTO user_profiles (user_id, workspace_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, workspace_id) DO NOTHING`,
    [userId, workspaceId]
  );
}
