import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const WORKSPACE_NAME = "Lincoln High School";
const SCHOOL_CODE = "LINCOLN";
const INSTRUCTOR_NAME = "Ms. Rivera";

// Ported verbatim from src/constants/mockMeasurements.js
const SESSION_SPECS = [
  // === Ms. Rivera · P3 (the student's class), Group G1 (the student's group) ===
  { sessionId: 's1', sessionName: 'Rivera P3 G1 Courtyard Walk', location: 'Main Courtyard', latitude: 40.8124, longitude: -73.9612, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'group', ownerCode: 'DEV001', date: '2026-06-01', startClock: '13:12:00', durationSec: 240, base: { pm25: 14, co: 0.5, temp: 21, humidity: 58 }, event: { metric: 'pm25', atFrac: 0.5, widthFrac: 0.06, magnitude: 34 } },
  { sessionId: 's2', sessionName: 'Rivera P3 G1 Gym', location: 'Gymnasium', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'public', ownerCode: 'DEV001', date: '2026-06-02', startClock: '08:47:00', durationSec: 180, base: { pm25: 23, co: 0.8, temp: 24, humidity: 49 } },
  { sessionId: 's3', sessionName: 'Rivera P3 G1 Cafeteria', location: 'Cafeteria', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'school', ownerCode: 'STU002', date: '2026-06-04', startClock: '14:05:00', durationSec: 300, base: { pm25: 31, co: 1.1, temp: 23, humidity: 61 } },
  { sessionId: 's4', sessionName: 'Rivera P3 G1 Entrance', location: 'Front Entrance', latitude: 40.8131, longitude: -73.9627, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'group', ownerCode: 'STU002', date: '2026-06-10', startClock: '09:30:00', durationSec: 150, base: { pm25: 9, co: 0.3, temp: 19, humidity: 66 } },

  // === Ms. Rivera · P3, Group G2 (same class, other group) ===
  { sessionId: 's5', sessionName: 'Rivera P3 G2 Library', location: 'Library', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'public', ownerCode: 'STU003', date: '2026-06-04', startClock: '14:22:00', durationSec: 210, base: { pm25: 18, co: 0.6, temp: 22, humidity: 54 } },
  { sessionId: 's6', sessionName: 'Rivera P3 G2 Chem Lab', location: 'Chemistry Lab', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'group', ownerCode: 'STU003', date: '2026-06-05', startClock: '10:15:00', durationSec: 270, base: { pm25: 44, co: 1.5, temp: 26, humidity: 42 } },
  { sessionId: 's7', sessionName: 'Rivera P3 G2 Art Studio', location: 'Art Studio', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU004', date: '2026-06-11', startClock: '11:40:00', durationSec: 240, base: { pm25: 16, co: 0.5, temp: 22, humidity: 57 } },

  // === Ms. Rivera · P5 (same teacher, DIFFERENT period) ===
  { sessionId: 's8', sessionName: 'Rivera P5 G1 Band Room', location: 'Band Room', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G1', visibility: 'group', ownerCode: 'STU005', date: '2026-06-05', startClock: '10:50:00', durationSec: 300, base: { pm25: 27, co: 0.9, temp: 24, humidity: 47 } },
  { sessionId: 's9', sessionName: 'Rivera P5 G2 Pool', location: 'Pool Deck', indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G2', visibility: 'public', ownerCode: 'STU006', date: '2026-06-12', startClock: '13:05:00', durationSec: 600, base: { pm25: 12, co: 0.4, temp: 27, humidity: 70 } },
  { sessionId: 's10', sessionName: 'Rivera P5 G1 Aux Gym', location: 'Auxiliary Gym', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G1', visibility: 'school', ownerCode: 'STU005', date: '2026-06-16', startClock: '08:55:00', durationSec: 200, base: { pm25: 20, co: 0.7, temp: 23, humidity: 51 } },

  // === Mr. Chen · P2 (a DIFFERENT class), Group G3 ===
  { sessionId: 's11', sessionName: 'Chen P2 G3 Field', location: 'Athletic Field', latitude: 40.8210, longitude: -73.9514, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G3', visibility: 'group', ownerCode: 'STU010', date: '2026-06-05', startClock: '15:20:00', durationSec: 180, base: { pm25: 8, co: 0.2, temp: 20, humidity: 63 } },
  { sessionId: 's12', sessionName: 'Chen P2 G3 Hallway', location: 'Main Hallway', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G3', visibility: 'public', ownerCode: 'STU010', date: '2026-06-15', startClock: '12:30:00', durationSec: 360, base: { pm25: 35, co: 1.2, temp: 25, humidity: 45 }, event: { metric: 'pm25', atFrac: 0.4, widthFrac: 0.05, magnitude: 28 } },

  // === Mr. Chen · P2, Group G4 ===
  { sessionId: 's13', sessionName: 'Chen P2 G4 Lot', location: 'Parking Lot', latitude: 40.8228, longitude: -73.9521, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G4', visibility: 'school', ownerCode: 'STU011', date: '2026-06-17', startClock: '13:45:00', durationSec: 600, base: { pm25: 52, co: 1.6, temp: 28, humidity: 38 }, event: { metric: 'pm25', atFrac: 0.6, widthFrac: 0.04, magnitude: 48 } },
  { sessionId: 's14', sessionName: 'Chen P2 G4 Track', location: 'Running Track', indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G4', visibility: 'group', ownerCode: 'STU011', date: '2026-06-18', startClock: '14:10:00', durationSec: 160, base: { pm25: 11, co: 0.3, temp: 21, humidity: 60 } },
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

// Matches MOCK_ROSTER ACCOUNTS order — student_code must align with session ownerCode values.
const STUDENTS = [
  { username: 'ava.martinez',  fullName: 'Ava Martinez',   period: 'P3', group: 'G1', studentCode: 'DEV001' },
  { username: 'lincoln-p3-g1', fullName: '',                period: 'P3', group: 'G1', studentCode: 'STU002' },
  { username: 'liam.chen',     fullName: 'Liam Chen',       period: 'P3', group: 'G2', studentCode: 'STU003' },
  { username: 'noah.patel',    fullName: 'Noah Patel',      period: 'P3', group: 'G3', studentCode: 'STU004' },
  { username: 'olivia.brown',  fullName: 'Olivia Brown',    period: 'P5', group: 'G1', studentCode: 'STU005' },
  { username: 'sophia.garcia', fullName: 'Sophia Garcia',   period: 'P5', group: 'G2', studentCode: 'STU006' },
  { username: 'mason.lee',     fullName: 'Mason Lee',       period: 'P5', group: 'G2', studentCode: 'STU007' },
  { username: 'lincoln-p5-g3', fullName: '',                period: 'P5', group: 'G3', studentCode: 'STU008' },
  { username: 'emma.davis',    fullName: 'Emma Davis',      period: 'P5', group: 'G4', studentCode: 'STU009' },
  { username: 'lucas.kim',     fullName: 'Lucas Kim',       period: 'P5', group: 'G5', studentCode: 'STU010' },
];

async function run() {
  await pool.query("BEGIN");
  try {
    // --- Users ---
    const teacherHash = await bcrypt.hash("rivera2026", 10);
    const teacherRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
       RETURNING id`,
      ["rivera@lincoln.mock", teacherHash, "Ms. Rivera"]
    );
    const teacherId = teacherRes.rows[0].id;

    const studentHash = await bcrypt.hash("lincoln2026", 10);
    const studentIds = {};
    for (const s of STUDENTS) {
      const email = `${s.username}@lincoln.mock`;
      const name = s.fullName || s.username;
      const res = await pool.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
         RETURNING id`,
        [email, studentHash, name]
      );
      studentIds[s.username] = res.rows[0].id;
    }

    // --- Workspace ---
    let workspaceId;
    const existingWs = await pool.query(`SELECT id FROM workspaces WHERE name = $1 LIMIT 1`, [WORKSPACE_NAME]);
    if (existingWs.rowCount) {
      workspaceId = existingWs.rows[0].id;
      await pool.query(`UPDATE workspaces SET created_by = $1 WHERE id = $2`, [teacherId, workspaceId]);
    } else {
      const wsRes = await pool.query(
        `INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id`,
        [WORKSPACE_NAME, teacherId]
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
       VALUES ($1, $2, 'owner')
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

    // --- Class structure ---
    await pool.query(
      `INSERT INTO workspace_class_structures (workspace_id, period_count, group_count, updated_by, updated_at)
       VALUES ($1, 2, 6, $2, NOW())
       ON CONFLICT (workspace_id)
       DO UPDATE SET period_count = EXCLUDED.period_count, group_count = EXCLUDED.group_count,
                     updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [workspaceId, teacherId]
    );

    // --- Join codes ---
    await pool.query(`DELETE FROM join_codes WHERE workspace_id = $1`, [workspaceId]);
    await pool.query(
      `INSERT INTO join_codes (workspace_id, created_by, code, school_code, instructor, active)
       VALUES ($1, $2, 'P3RVK', $3, $4, true)`,
      [workspaceId, teacherId, SCHOOL_CODE, INSTRUCTOR_NAME]
    );
    await pool.query(
      `INSERT INTO join_codes (workspace_id, created_by, code, school_code, instructor, active)
       VALUES ($1, $2, 'P5RVM', $3, $4, false)`,
      [workspaceId, teacherId, SCHOOL_CODE, INSTRUCTOR_NAME]
    );

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
      const lats        = readings.map(() => spec.latitude ?? null);
      const lngs        = readings.map(() => spec.longitude ?? null);
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
      teacher: { email: "rivera@lincoln.mock", password: "rivera2026", role: "owner" },
      students: STUDENTS.map((s) => ({ email: `${s.username}@lincoln.mock`, password: "lincoln2026", period: s.period, group: s.group, studentCode: s.studentCode })),
      joinCodes: [{ code: "P3RVK", active: true }, { code: "P5RVM", active: false }],
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
