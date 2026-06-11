/**
 * DEV ONLY - MOCK DATA - REMOVE BEFORE DEPLOY
 *
 * Stubbed measurement data for building the Raw Data redesign before the backend
 * is ready. Flip MOCK_DATA_ENABLED to false (or delete this file + its imports in
 * RawDataView.js) to return to live/imported data only.
 *
 * SHAPE: matches reality — the sensor records ~one reading per second, so a SESSION
 * is a container of many per-second readings. Each entry below is ONE session; the
 * generator expands it into a realistic per-second time series (gradual drift around
 * a baseline, with an optional mid-session event). The table lists one row per
 * session showing the session MEAN per metric; the expanded row + CSV export draw
 * from the per-second `detailedData`.
 *
 * We build session display rows directly here (NOT via workspaceMeasurementsToDisplayRows,
 * which buckets by minute) so each session stays a single row.
 *
 * Data model: a "class" is a (teacher, period) pair. The mock student belongs to ONE
 * class-period (Ms. Rivera · P3, group G1).
 *
 * TODO(backend): `visibility`/`owner_student_code` are not yet returned by the API,
 * and the real read path (groupMeasurementRowsForDisplay) groups by MINUTE, not by
 * session — see the "one-reading-per-session" flags noted to the team.
 */

export const MOCK_DATA_ENABLED = true;

/** The fake "current student": school, code, and the single class-period they belong to. */
export const MOCK_IDENTITY = {
  school: 'LINCOLN',
  studentCode: 'DEV001',
  memberships: [
    { instructor: 'Ms. Rivera', period: 'P3', group: 'G1' },
  ],
};

// One entry per SESSION (14 total). Same scope/visibility structure as before, so the
// verification table holds. durationSec = number of per-second readings (2–10 min).
// Visibility tokens: 'public' | 'school' | 'group'. Optional `event` adds a
// gaussian spike to one metric mid-session.
const SESSION_SPECS = [
  // === Ms. Rivera · P3 (the student's class), Group G1 (the student's group) ===
  { id: 'm1', sessionId: 's1', sessionName: 'Rivera P3 G1 Courtyard Walk', location: 'Main Courtyard', latitude: 40.8124, longitude: -73.9612, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'group', ownerCode: 'DEV001', date: '2026-06-01', startClock: '13:12:00', durationSec: 240, base: { pm25: 14, co: 0.5, temp: 21, humidity: 58 }, event: { metric: 'pm25', atFrac: 0.5, widthFrac: 0.06, magnitude: 34 } },
  { id: 'm2', sessionId: 's2', sessionName: 'Rivera P3 G1 Gym', location: 'Gymnasium', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'public', ownerCode: 'DEV001', date: '2026-06-02', startClock: '08:47:00', durationSec: 180, base: { pm25: 23, co: 0.8, temp: 24, humidity: 49 } },
  { id: 'm3', sessionId: 's3', sessionName: 'Rivera P3 G1 Cafeteria', location: 'Cafeteria', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'school', ownerCode: 'STU002', date: '2026-06-04', startClock: '14:05:00', durationSec: 300, base: { pm25: 31, co: 1.1, temp: 23, humidity: 61 } },
  { id: 'm4', sessionId: 's4', sessionName: 'Rivera P3 G1 Entrance', location: 'Front Entrance', latitude: 40.8131, longitude: -73.9627, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G1', visibility: 'group', ownerCode: 'STU002', date: '2026-06-10', startClock: '09:30:00', durationSec: 150, base: { pm25: 9, co: 0.3, temp: 19, humidity: 66 } },

  // === Ms. Rivera · P3, Group G2 (same class, other group) ===
  { id: 'm5', sessionId: 's5', sessionName: 'Rivera P3 G2 Library', location: 'Library', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'public', ownerCode: 'STU003', date: '2026-06-04', startClock: '14:22:00', durationSec: 210, base: { pm25: 18, co: 0.6, temp: 22, humidity: 54 } },
  { id: 'm6', sessionId: 's6', sessionName: 'Rivera P3 G2 Chem Lab', location: 'Chemistry Lab', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'group', ownerCode: 'STU003', date: '2026-06-05', startClock: '10:15:00', durationSec: 270, base: { pm25: 44, co: 1.5, temp: 26, humidity: 42 } }, // hidden from DEV001 (group-only, not the student's group)
  { id: 'm7', sessionId: 's7', sessionName: 'Rivera P3 G2 Art Studio', location: 'Art Studio', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group: 'G2', visibility: 'school', ownerCode: 'STU004', date: '2026-06-11', startClock: '11:40:00', durationSec: 240, base: { pm25: 16, co: 0.5, temp: 22, humidity: 57 } },

  // === Ms. Rivera · P5 (same teacher, DIFFERENT period → NOT the student's class) ===
  { id: 'm8', sessionId: 's8', sessionName: 'Rivera P5 G1 Band Room', location: 'Band Room', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G1', visibility: 'group', ownerCode: 'STU005', date: '2026-06-05', startClock: '10:50:00', durationSec: 300, base: { pm25: 27, co: 0.9, temp: 24, humidity: 47 } }, // hidden from DEV001 (group-only, P5 G1 not the student's group)
  { id: 'm9', sessionId: 's9', sessionName: 'Rivera P5 G2 Pool', location: 'Pool Deck', indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G2', visibility: 'public', ownerCode: 'STU006', date: '2026-06-12', startClock: '13:05:00', durationSec: 600, base: { pm25: 12, co: 0.4, temp: 27, humidity: 70 } }, // ~10 min volume test
  { id: 'm10', sessionId: 's10', sessionName: 'Rivera P5 G1 Aux Gym', location: 'Auxiliary Gym', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group: 'G1', visibility: 'school', ownerCode: 'STU005', date: '2026-06-16', startClock: '08:55:00', durationSec: 200, base: { pm25: 20, co: 0.7, temp: 23, humidity: 51 } },

  // === Mr. Chen · P2 (a DIFFERENT class, the student is not in it), Group G3 ===
  { id: 'm11', sessionId: 's11', sessionName: 'Chen P2 G3 Field', location: 'Athletic Field', latitude: 40.8210, longitude: -73.9514, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G3', visibility: 'group', ownerCode: 'STU010', date: '2026-06-05', startClock: '15:20:00', durationSec: 180, base: { pm25: 8, co: 0.2, temp: 20, humidity: 63 } }, // hidden from DEV001 (group-only, not the student's group)
  { id: 'm12', sessionId: 's12', sessionName: 'Chen P2 G3 Hallway', location: 'Main Hallway', indoorOutdoor: 'INDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G3', visibility: 'public', ownerCode: 'STU010', date: '2026-06-15', startClock: '12:30:00', durationSec: 360, base: { pm25: 35, co: 1.2, temp: 25, humidity: 45 }, event: { metric: 'pm25', atFrac: 0.4, widthFrac: 0.05, magnitude: 28 } },

  // === Mr. Chen · P2, Group G4 (same class, other group) ===
  { id: 'm13', sessionId: 's13', sessionName: 'Chen P2 G4 Lot', location: 'Parking Lot', latitude: 40.8228, longitude: -73.9521, indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G4', visibility: 'school', ownerCode: 'STU011', date: '2026-06-17', startClock: '13:45:00', durationSec: 600, base: { pm25: 52, co: 1.6, temp: 28, humidity: 38 }, event: { metric: 'pm25', atFrac: 0.6, widthFrac: 0.04, magnitude: 48 } }, // ~10 min + car-passing spike
  { id: 'm14', sessionId: 's14', sessionName: 'Chen P2 G4 Track', location: 'Running Track', indoorOutdoor: 'OUTDOOR', school: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group: 'G4', visibility: 'group', ownerCode: 'STU011', date: '2026-06-18', startClock: '14:10:00', durationSec: 160, base: { pm25: 11, co: 0.3, temp: 21, humidity: 60 } }, // hidden from DEV001 (group-only, not the student's group)
];

// Deterministic PRNG so the data (and the calendar / charts) are stable across reloads.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Expand one session spec into a session display row containing per-second readings.
function buildSession(spec, index) {
  const rng = makeRng(2026 + index * 131 + spec.durationSec);
  const startMs = Date.parse(`${spec.date}T${spec.startClock}Z`);
  const n = spec.durationSec;
  const phase = index * 0.7;
  const readings = [];
  let sumPm = 0, sumCo = 0, sumTemp = 0, sumHum = 0;

  for (let i = 0; i < n; i++) {
    const frac = n > 1 ? i / (n - 1) : 0;
    const iso = new Date(startMs + i * 1000).toISOString();
    const drift = (amp, mult) => amp * Math.sin(2 * Math.PI * frac * mult + phase);
    const noise = (scale) => (rng() - 0.5) * 2 * scale;
    const eventBump = (metric) => {
      const ev = spec.event;
      if (!ev || ev.metric !== metric) return 0;
      return ev.magnitude * Math.exp(-Math.pow((frac - ev.atFrac) / ev.widthFrac, 2));
    };

    const pm25 = Math.max(0, Math.round(spec.base.pm25 + drift(spec.base.pm25 * 0.12 + 1, 1.5) + noise(1.2) + eventBump('pm25')));
    const co = Math.max(0, Number((spec.base.co + drift(spec.base.co * 0.12 + 0.03, 1.2) + noise(0.04) + eventBump('co')).toFixed(2)));
    const temp = Math.round(spec.base.temp + drift(1.1, 1.0) + noise(0.3) + eventBump('temp'));
    const humidity = Math.max(0, Math.min(100, Math.round(spec.base.humidity + drift(2.5, 0.8) + noise(0.8) + eventBump('humidity'))));

    readings.push({ id: `${spec.id}-${i}`, time: iso.slice(11, 19), pm25, co, temp, humidity });
    sumPm += pm25; sumCo += co; sumTemp += temp; sumHum += humidity;
  }

  const startIso = new Date(startMs).toISOString();
  return {
    id: spec.id,
    sessionId: spec.sessionId,
    sessionName: spec.sessionName,
    sessionNotes: '',
    date: startIso.slice(0, 10),
    time: startIso.slice(11, 16),
    capturedAt: startIso,
    location: spec.location,
    latitude: spec.latitude ?? null,
    longitude: spec.longitude ?? null,
    indoorOutdoor: spec.indoorOutdoor,
    school: spec.school,
    instructor: spec.instructor,
    period: spec.period,
    group: spec.group,
    // Session summary = MEAN per metric (matches groupMeasurementRowsForDisplay).
    pm25: Math.round(sumPm / n),
    co: (sumCo / n).toFixed(2),
    temp: Math.round(sumTemp / n),
    humidity: Math.round(sumHum / n),
    photos: [],
    edits: {},
    count: n,
    detailedData: readings,
    visibility: spec.visibility,
    ownerCode: spec.ownerCode,
  };
}

export const MOCK_MEASUREMENTS = SESSION_SPECS.map(buildSession);

/**
 * True if `row` is visible to `identity` under the phone-set visibility rules.
 * Three levels: 'public' (everyone), 'school' (same school), 'group' (default — that
 * exact group's members). TODO(researcher-mode): 'class' and 'me' were removed for now
 * and are reserved for a future researcher mode.
 */
export function isRowVisibleToViewer(row, identity) {
  switch (row.visibility) {
    case 'public':
      return true;
    case 'school':
      return row.school === identity.school;
    case 'group':
      // Group only → visible to members of that exact group (teacher + period + group).
      return (identity.memberships || []).some(
        (m) => m.instructor === row.instructor && m.period === row.period && m.group === row.group
      );
    default:
      return true;
  }
}
