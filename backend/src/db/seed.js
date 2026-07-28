import crypto from "node:crypto";
import { pool } from "./pool.js";
import { firebaseAuth } from "../config/firebase-admin.js";
import { reconcileAggregateMemberships } from "../modules/auth/memberships.js";

// Same shape as the invite tokens minted by POST /auth/workspaces/:id/invitations.
const makeInviteToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * Create (or update) the Firebase account for a seeded user and return its uid.
 * Firebase owns credentials now, so seeded logins only work if these accounts exist there too.
 */
async function ensureFirebaseUser(email, password, displayName) {
  const auth = firebaseAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName });
    return existing.uid;
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      const created = await auth.createUser({ email, password, displayName });
      return created.uid;
    }
    throw error;
  }
}

const WORKSPACE_NAME = "Ms. Rivera's Science Class"; // a class workspace (distinct from the school)
const SCHOOL_NAME = "Abraham Lincoln High School"; // located program school (009_program_school_catalog.sql)
const SCHOOL_CODE = "LINCOLN";
const INSTRUCTOR_NAME = "Ms. Rivera";

// All sessions live in Ms. Rivera's class and are owned by the three seeded students.
// Same locations / coordinates / durations / readings as before — only ownership and placement
// were reassigned so no data references a removed account:
//   Ava Martinez  · P3 G1 · DEV001   (s1–s5)
//   Liam Chen     · P3 G2 · STU003   (s6–s10)
//   Noah Patel    · P3 G3 · STU004   (s11–s14)
// Outdoor GPS anchors around Abraham Lincoln High School (Northeast Philly), NOT NYC —
// older seed coords near Columbia University drew absurd Philly↔NYC "trails" on the map.
const LINCOLN_CAMPUS = { lat: 40.0401, lng: -75.0312 };

const SESSION_SPECS = [
  // === Ava Martinez · P3 G1 (DEV001) ===
  { sessionId: 's1', sessionName: 'Rivera P3 G1 Courtyard Walk', location: 'Main Courtyard', latitude: LINCOLN_CAMPUS.lat, longitude: LINCOLN_CAMPUS.lng, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'school', ownerCode: 'DEV001', date: '2026-06-01', startClock: '13:12:00', durationSec: 240, base: { pm25: 14, co: 0.5, temp: 21, humidity: 58 }, event: { metric: 'pm25', atFrac: 0.5, widthFrac: 0.06, magnitude: 34 } },
  { sessionId: 's2', sessionName: 'Rivera P3 G1 Gym', location: 'Gymnasium', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'public', ownerCode: 'DEV001', date: '2026-06-02', startClock: '08:47:00', durationSec: 180, base: { pm25: 23, co: 0.8, temp: 24, humidity: 49 } },
  { sessionId: 's3', sessionName: 'Rivera P3 G1 Cafeteria', location: 'Cafeteria', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'school', ownerCode: 'DEV001', date: '2026-06-04', startClock: '14:05:00', durationSec: 300, base: { pm25: 31, co: 1.1, temp: 23, humidity: 61 } },
  { sessionId: 's4', sessionName: 'Rivera P3 G1 Entrance', location: 'Front Entrance', latitude: 40.0405, longitude: -75.0320, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'school', ownerCode: 'DEV001', date: '2026-06-10', startClock: '09:30:00', durationSec: 150, base: { pm25: 9, co: 0.3, temp: 19, humidity: 66 } },
  { sessionId: 's5', sessionName: 'Rivera P3 G1 Library', location: 'Library', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'public', ownerCode: 'DEV001', date: '2026-06-04', startClock: '14:22:00', durationSec: 210, base: { pm25: 18, co: 0.6, temp: 22, humidity: 54 } },

  // === Liam Chen · P3 G2 (STU003) ===
  { sessionId: 's6', sessionName: 'Rivera P3 G2 Chem Lab', location: 'Chemistry Lab', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU003', date: '2026-06-05', startClock: '10:15:00', durationSec: 270, base: { pm25: 44, co: 1.5, temp: 26, humidity: 42 } },
  { sessionId: 's7', sessionName: 'Rivera P3 G2 Art Studio', location: 'Art Studio', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU003', date: '2026-06-11', startClock: '11:40:00', durationSec: 240, base: { pm25: 16, co: 0.5, temp: 22, humidity: 57 } },
  { sessionId: 's8', sessionName: 'Rivera P3 G2 Band Room', location: 'Band Room', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU003', date: '2026-06-05', startClock: '10:50:00', durationSec: 300, base: { pm25: 27, co: 0.9, temp: 24, humidity: 47 } },
  { sessionId: 's9', sessionName: 'Rivera P3 G2 Pool', location: 'Pool Deck', latitude: 40.0408, longitude: -75.0298, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'public', ownerCode: 'STU003', date: '2026-06-12', startClock: '13:05:00', durationSec: 600, base: { pm25: 12, co: 0.4, temp: 27, humidity: 70 } },
  { sessionId: 's10', sessionName: 'Rivera P3 G2 Aux Gym', location: 'Auxiliary Gym', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU003', date: '2026-06-16', startClock: '08:55:00', durationSec: 200, base: { pm25: 20, co: 0.7, temp: 23, humidity: 51 } },

  // === Noah Patel · P3 G3 (STU004) ===
  { sessionId: 's11', sessionName: 'Rivera P3 G3 Field', location: 'Athletic Field', latitude: 40.0412, longitude: -75.0305, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G3', visibility: 'school', ownerCode: 'STU004', date: '2026-06-05', startClock: '15:20:00', durationSec: 180, base: { pm25: 8, co: 0.2, temp: 20, humidity: 63 } },
  { sessionId: 's12', sessionName: 'Rivera P3 G3 Hallway', location: 'Main Hallway', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G3', visibility: 'public', ownerCode: 'STU004', date: '2026-06-15', startClock: '12:30:00', durationSec: 360, base: { pm25: 35, co: 1.2, temp: 25, humidity: 45 }, event: { metric: 'pm25', atFrac: 0.4, widthFrac: 0.05, magnitude: 28 } },
  { sessionId: 's13', sessionName: 'Rivera P3 G3 Lot', location: 'Parking Lot', latitude: 40.0395, longitude: -75.0325, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G3', visibility: 'school', ownerCode: 'STU004', date: '2026-06-17', startClock: '13:45:00', durationSec: 600, base: { pm25: 52, co: 1.6, temp: 28, humidity: 38 }, event: { metric: 'pm25', atFrac: 0.6, widthFrac: 0.04, magnitude: 48 } },
  { sessionId: 's14', sessionName: 'Rivera P3 G3 Track', location: 'Running Track', latitude: 40.0415, longitude: -75.0310, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G3', visibility: 'school', ownerCode: 'STU004', date: '2026-06-18', startClock: '14:10:00', durationSec: 160, base: { pm25: 11, co: 0.3, temp: 21, humidity: 60 } },
];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Returns per-second readings for a session spec. Each reading has capturedAt (ISO), pm25, co, temp, humidity.
function buildReadings(spec, index) {
  const rng = makeRng(2026 + index * 131 + spec.durationSec);
  const startMs = Date.parse(`${spec.date}T${spec.startClock}Z`);
  const n = spec.durationSec;
  const phase = index * 0.7;
  const readings = [];

  for (let i = 0; i < n; i++) {
    const frac = n > 1 ? i / (n - 1) : 0;
    const drift = (amp, mult) => amp * Math.sin(2 * Math.PI * frac * mult + phase);
    const noise = (scale) => (rng() - 0.5) * 2 * scale;
    const eventBump = (metric) => {
      const ev = spec.event;
      if (!ev || ev.metric !== metric) return 0;
      return ev.magnitude * Math.exp(-Math.pow((frac - ev.atFrac) / ev.widthFrac, 2));
    };

    readings.push({
      capturedAt: new Date(startMs + i * 1000).toISOString(),
      pm25: Math.max(0, Math.round(spec.base.pm25 + drift(spec.base.pm25 * 0.12 + 1, 1.5) + noise(1.2) + eventBump('pm25'))),
      co: Math.max(0, Number((spec.base.co + drift(spec.base.co * 0.12 + 0.03, 1.2) + noise(0.04) + eventBump('co')).toFixed(2))),
      temp: Math.round(spec.base.temp + drift(1.1, 1.0) + noise(0.3) + eventBump('temp')),
      humidity: Math.max(0, Math.min(100, Math.round(spec.base.humidity + drift(2.5, 0.8) + noise(0.8) + eventBump('humidity')))),
    });
  }
  return readings;
}

// One teacher + three individually-named students. No shared/group accounts.
// student_code aligns with the session ownerCode values in SESSION_SPECS.
const STUDENTS = [
  { username: 'ava.martinez', fullName: 'Ava Martinez', period: 'P3', group: 'G1', studentCode: 'DEV001' },
  { username: 'liam.chen',    fullName: 'Liam Chen',    period: 'P3', group: 'G2', studentCode: 'STU003' },
  { username: 'noah.patel',   fullName: 'Noah Patel',   period: 'P3', group: 'G3', studentCode: 'STU004' },
];

async function run() {
  await pool.query("BEGIN");
  try {
    // --- Users (provisioned in Firebase, then linked here by firebase_uid) ---
    const teacherUid = await ensureFirebaseUser("rivera@lincoln.mock", "rivera2026", "Ms. Rivera");
    const teacherRes = await pool.query(
      `INSERT INTO users (email, firebase_uid, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, full_name = EXCLUDED.full_name
       RETURNING id`,
      ["rivera@lincoln.mock", teacherUid, "Ms. Rivera"]
    );
    const teacherId = teacherRes.rows[0].id;

    const studentIds = {};
    for (const s of STUDENTS) {
      const email = `${s.username}@lincoln.mock`;
      const name = s.fullName || s.username;
      const uid = await ensureFirebaseUser(email, "lincoln2026", name);
      const res = await pool.query(
        `INSERT INTO users (email, firebase_uid, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, full_name = EXCLUDED.full_name
         RETURNING id`,
        [email, uid, name]
      );
      studentIds[s.username] = res.rows[0].id;
    }

    // --- Workspace (a class) tagged with its school so its members join the school workspace ---
    const schoolRow = await pool.query(`SELECT id FROM schools WHERE name = $1 LIMIT 1`, [SCHOOL_NAME]);
    const schoolId = schoolRow.rows[0]?.id || null;

    let workspaceId;
    const existingWs = await pool.query(
      `SELECT id FROM workspaces WHERE name = $1 AND kind = 'class' LIMIT 1`,
      [WORKSPACE_NAME]
    );
    if (existingWs.rowCount) {
      workspaceId = existingWs.rows[0].id;
      await pool.query(`UPDATE workspaces SET created_by = $1, school_id = $2 WHERE id = $3`, [teacherId, schoolId, workspaceId]);
    } else {
      const wsRes = await pool.query(
        `INSERT INTO workspaces (name, kind, created_by, school_id) VALUES ($1, 'class', $2, $3) RETURNING id`,
        [WORKSPACE_NAME, teacherId, schoolId]
      );
      workspaceId = wsRes.rows[0].id;
    }

    // --- Memberships: keep only seeded users, remove any others ---
    const allUserIds = [teacherId, ...Object.values(studentIds)];
    await pool.query(
      `DELETE FROM workspace_memberships WHERE workspace_id = $1 AND user_id <> ALL($2::uuid[])`,
      [workspaceId, allUserIds]
    );
    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES ($1, $2, 'teacher')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [workspaceId, teacherId]
    );
    for (const s of STUDENTS) {
      await pool.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, 'student')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, studentIds[s.username]]
      );
    }

    // --- User profiles ---
    await pool.query(`DELETE FROM user_profiles WHERE workspace_id = $1`, [workspaceId]);
    await pool.query(
      `INSERT INTO user_profiles (user_id, workspace_id, school_code, instructor, period, group_code, student_code)
       VALUES ($1, $2, $3, $4, 'P1', '', 'INST001')`,
      [teacherId, workspaceId, SCHOOL_CODE, INSTRUCTOR_NAME]
    );
    for (const s of STUDENTS) {
      await pool.query(
        `INSERT INTO user_profiles (user_id, workspace_id, school_code, instructor, period, group_code, student_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentIds[s.username], workspaceId, SCHOOL_CODE, INSTRUCTOR_NAME, s.period, s.group, s.studentCode]
      );
    }

    // --- Auto-join Public + the Lincoln school workspace for every seeded member ---
    for (const userId of allUserIds) {
      await reconcileAggregateMemberships(pool, userId);
    }

    // --- Class structure ---
    await pool.query(
      `INSERT INTO workspace_class_structures (workspace_id, period_count, group_count, updated_by, updated_at)
       VALUES ($1, 2, 6, $2, NOW())
       ON CONFLICT (workspace_id)
       DO UPDATE SET period_count = EXCLUDED.period_count, group_count = EXCLUDED.group_count,
                     updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [workspaceId, teacherId]
    );

    // --- Invitations ---
    // Students joined by invitation in this model, so seed an accepted invite per student,
    // plus two pending invites (student + co-teacher) whose links are printed for manual testing.
    await pool.query(`DELETE FROM invitations WHERE workspace_id = $1`, [workspaceId]);
    for (const s of STUDENTS) {
      await pool.query(
        `INSERT INTO invitations
           (workspace_id, email, role, token, invited_by, period, status, accepted_at, accepted_by_user_id)
         VALUES ($1, $2, 'student', $3, $4, $5, 'accepted', NOW(), $6)`,
        [workspaceId, `${s.username}@lincoln.mock`, makeInviteToken(), teacherId, s.period, studentIds[s.username]]
      );
    }
    const pendingInvites = [];
    for (const invite of [
      { email: "new.student@lincoln.mock", role: "student", period: "P3" },
      { email: "chen@lincoln.mock", role: "teacher", period: "" },
    ]) {
      const token = makeInviteToken();
      await pool.query(
        `INSERT INTO invitations (workspace_id, email, role, token, invited_by, period)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, invite.email, invite.role, token, teacherId, invite.period]
      );
      pendingInvites.push({ email: invite.email, role: invite.role, link: `http://localhost:3000/join/${token}` });
    }

    // --- Clear existing sessions/measurements for this workspace ---
    await pool.query(`DELETE FROM measurement_edits WHERE workspace_id = $1`, [workspaceId]);
    await pool.query(`DELETE FROM measurements WHERE workspace_id = $1`, [workspaceId]);
    await pool.query(`DELETE FROM sessions WHERE workspace_id = $1`, [workspaceId]);

    // --- Sessions + measurements ---
    for (let i = 0; i < SESSION_SPECS.length; i++) {
      const spec = SESSION_SPECS[i];
      const startedAt = new Date(`${spec.date}T${spec.startClock}Z`);
      const endedAt = new Date(startedAt.getTime() + spec.durationSec * 1000);

      const sessionRes = await pool.query(
        `INSERT INTO sessions
           (workspace_id, created_by, session_code, name, notes, location_name,
            school_code, instructor, period, group_code,
            started_at, ended_at, visibility, owner_student_code)
         VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          workspaceId, teacherId, spec.sessionId, spec.sessionName, spec.location,
          spec.school, spec.instructor, spec.period, spec.group,
          startedAt.toISOString(), endedAt.toISOString(),
          spec.visibility, spec.ownerCode,
        ]
      );
      const sessionId = sessionRes.rows[0].id;

      const readings = buildReadings(spec, i);

      // Batch insert via unnest to avoid per-row round-trips
      const capturedAts = readings.map((r) => r.capturedAt);
      const pm25s       = readings.map((r) => r.pm25);
      const cos         = readings.map((r) => r.co);
      const temps       = readings.map((r) => r.temp);
      const humidities  = readings.map((r) => r.humidity);
      // Outdoor walks get a short campus path (so minute-aggregated trails aren't a single point).
      // Stay within ~150m of the session anchor — never city-scale jumps.
      const lats = readings.map((_, idx) => {
        if (spec.latitude == null) return null;
        const t = readings.length > 1 ? idx / (readings.length - 1) : 0;
        return spec.latitude + Math.sin(t * Math.PI * 2 + i) * 0.0009;
      });
      const lngs = readings.map((_, idx) => {
        if (spec.longitude == null) return null;
        const t = readings.length > 1 ? idx / (readings.length - 1) : 0;
        return spec.longitude + Math.cos(t * Math.PI * 2 + i * 0.7) * 0.0011;
      });
      const indoors     = readings.map(() => spec.indoorOutdoor);
      const wsIds       = readings.map(() => workspaceId);
      const sessIds     = readings.map(() => sessionId);

      await pool.query(
        `INSERT INTO measurements
           (workspace_id, session_id, captured_at, latitude, longitude,
            indoor_outdoor, pm25, co, temp, humidity)
         SELECT * FROM unnest(
           $1::uuid[], $2::uuid[], $3::timestamptz[],
           $4::float8[], $5::float8[], $6::text[],
           $7::float8[], $8::float8[], $9::float8[], $10::float8[]
         )`,
        [wsIds, sessIds, capturedAts, lats, lngs, indoors, pm25s, cos, temps, humidities]
      );
    }

    await pool.query("COMMIT");

    const totalMeasurements = SESSION_SPECS.reduce((sum, s) => sum + s.durationSec, 0);
    console.log("Seed complete.");
    console.log({
      workspaceId,
      workspaceName: WORKSPACE_NAME,
      schoolCode: SCHOOL_CODE,
      teacher: { email: "rivera@lincoln.mock", password: "rivera2026", role: "teacher" },
      students: STUDENTS.map((s) => ({ email: `${s.username}@lincoln.mock`, password: "lincoln2026", period: s.period, group: s.group, studentCode: s.studentCode })),
      pendingInvites,
      sessions: SESSION_SPECS.length,
      measurements: totalMeasurements,
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
