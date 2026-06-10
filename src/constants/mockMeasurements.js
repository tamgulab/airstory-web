/**
 * DEV ONLY - MOCK DATA - REMOVE BEFORE DEPLOY
 *
 * Stubbed measurement data for building the Raw Data redesign before the backend
 * is ready. Flip MOCK_DATA_ENABLED to false (or delete this file + its imports in
 * RawDataView.js) to return to live/imported data only.
 *
 * Rows are authored in the GET /measurements API shape from docs/API_REFERENCE.md
 * (snake_case), then mapped to display rows via the shared mapper so they render
 * exactly like real data.
 *
 * Data model: a "class" is a (teacher, period) pair — period never stands alone.
 * The mock student belongs to ONE class-period (Ms. Rivera · P3, group G1).
 *
 * TODO(backend): `visibility` and `owner_student_code` are NOT yet returned by
 * GET /workspaces/:id/measurements. Visibility is ultimately set on the phone
 * before upload and is read-only in the web app. Remove these mock fields and read
 * the real `visibility` column once the API provides it.
 */
import { workspaceMeasurementsToDisplayRows } from '../utils/measurementRows';

export const MOCK_DATA_ENABLED = true;

/** The fake "current student": school, code, and the class-periods they belong to. */
export const MOCK_IDENTITY = {
  school: 'LINCOLN',
  studentCode: 'DEV001',
  // The student's single class-period (teacher · period) and their group in it.
  memberships: [
    { instructor: 'Ms. Rivera', period: 'P3', group: 'G1' },
  ],
};

// Visibility tokens: 'public' | 'school' | 'class' | 'me'
const RAW_MOCK_MEASUREMENTS = [
  // === Ms. Rivera · P3 (the student's class), Group G1 (the student's group) ===
  { id: 'm1', captured_at: '2026-06-01T15:01:00Z', session_id: 's1', session_code: 'R3G1-0601', session_name: 'Rivera P3 G1 Walk', location_name: 'Front Lawn', latitude: 40.81, longitude: -73.96, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 12, co: 0.4, temp: 22, humidity: 55, visibility: 'me', owner_student_code: 'DEV001' },
  { id: 'm2', captured_at: '2026-06-01T15:02:00Z', session_id: 's2', session_code: 'R3G1-0601', session_name: 'Rivera P3 G1 Walk', location_name: 'Gym', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 18, co: 0.6, temp: 24, humidity: 48, visibility: 'public', owner_student_code: 'DEV001' },
  { id: 'm3', captured_at: '2026-06-02T15:03:00Z', session_id: 's3', session_code: 'R3G1-0602', session_name: 'Rivera P3 G1 Indoor', location_name: 'Cafeteria', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 25, co: 0.9, temp: 23, humidity: 60, visibility: 'class', owner_student_code: 'STU002' },
  { id: 'm4', captured_at: '2026-06-08T15:04:00Z', session_id: 's4', session_code: 'R3G1-0608', session_name: 'Rivera P3 G1 Courtyard', location_name: 'Courtyard', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 9, co: 0.3, temp: 21, humidity: 52, visibility: 'school', owner_student_code: 'STU002' },

  // === Ms. Rivera · P3, Group G2 (same class, other group) ===
  { id: 'm5', captured_at: '2026-06-02T15:05:00Z', session_id: 's5', session_code: 'R3G2-0602', session_name: 'Rivera P3 G2 Library', location_name: 'Library', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 21, co: 0.7, temp: 23, humidity: 58, visibility: 'public', owner_student_code: 'STU003' },
  { id: 'm6', captured_at: '2026-06-03T15:06:00Z', session_id: 's6', session_code: 'R3G2-0603', session_name: 'Rivera P3 G2 Lab', location_name: 'Science Lab', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 30, co: 1.1, temp: 25, humidity: 45, visibility: 'me', owner_student_code: 'STU003' }, // hidden from DEV001 (me-only, not owner)
  { id: 'm7', captured_at: '2026-06-08T15:07:00Z', session_id: 's7', session_code: 'R3G2-0608', session_name: 'Rivera P3 G2 Art', location_name: 'Art Room', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 16, co: 0.5, temp: 22, humidity: 56, visibility: 'class', owner_student_code: 'STU004' },

  // === Ms. Rivera · P5 (same teacher, DIFFERENT period → NOT the student's class) ===
  { id: 'm8', captured_at: '2026-06-03T15:08:00Z', session_id: 's8', session_code: 'R5G1-0603', session_name: 'Rivera P5 G1 Music', location_name: 'Music Room', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G1', pm25: 27, co: 0.8, temp: 24, humidity: 47, visibility: 'class', owner_student_code: 'STU005' }, // hidden from DEV001 (class-only, P5 not the student's period)
  { id: 'm9', captured_at: '2026-06-04T15:09:00Z', session_id: 's9', session_code: 'R5G2-0604', session_name: 'Rivera P5 G2 Pool', location_name: 'Pool Deck', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G2', pm25: 14, co: 0.4, temp: 26, humidity: 65, visibility: 'public', owner_student_code: 'STU006' },
  { id: 'm10', captured_at: '2026-06-09T15:10:00Z', session_id: 's10', session_code: 'R5G1-0609', session_name: 'Rivera P5 G1 Gym B', location_name: 'Gym B', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G1', pm25: 19, co: 0.6, temp: 23, humidity: 50, visibility: 'school', owner_student_code: 'STU005' },

  // === Mr. Chen · P2 (a DIFFERENT class, the student is not in it), Group G3 ===
  { id: 'm11', captured_at: '2026-06-04T15:11:00Z', session_id: 's11', session_code: 'C2G3-0604', session_name: 'Chen P2 G3 Field', location_name: 'Athletic Field', latitude: 40.82, longitude: -73.95, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G3', pm25: 8, co: 0.2, temp: 20, humidity: 62, visibility: 'class', owner_student_code: 'STU010' }, // hidden from DEV001 (class-only, not the student's class)
  { id: 'm12', captured_at: '2026-06-05T15:12:00Z', session_id: 's12', session_code: 'C2G3-0605', session_name: 'Chen P2 G3 Hallway', location_name: 'Hallway', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G3', pm25: 27, co: 0.8, temp: 24, humidity: 47, visibility: 'public', owner_student_code: 'STU010' },

  // === Mr. Chen · P2, Group G4 (same class, other group) ===
  { id: 'm13', captured_at: '2026-06-05T15:13:00Z', session_id: 's13', session_code: 'C2G4-0605', session_name: 'Chen P2 G4 Lot', location_name: 'Parking Lot', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G4', pm25: 35, co: 1.4, temp: 26, humidity: 40, visibility: 'school', owner_student_code: 'STU011' },
  { id: 'm14', captured_at: '2026-06-09T15:14:00Z', session_id: 's14', session_code: 'C2G4-0609', session_name: 'Chen P2 G4 Track', location_name: 'Track', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G4', pm25: 11, co: 0.3, temp: 21, humidity: 59, visibility: 'me', owner_student_code: 'STU011' }, // hidden from DEV001 (me-only, not owner)
];

// Map raw API rows → display rows, then re-attach the mock-only visibility/owner
// fields (the shared mapper doesn't know about them).
const displayRows = workspaceMeasurementsToDisplayRows(RAW_MOCK_MEASUREMENTS);
export const MOCK_MEASUREMENTS = displayRows.map((row) => {
  const src = RAW_MOCK_MEASUREMENTS.find((r) => `chunk-${r.id}` === row.id) || {};
  return { ...row, visibility: src.visibility, ownerCode: src.owner_student_code };
});

/**
 * True if `row` is visible to `identity` under the phone-set visibility rules.
 * "class only" means the SAME class-period (teacher AND period), checked against
 * any of the viewer's memberships.
 */
export function isRowVisibleToViewer(row, identity) {
  switch (row.visibility) {
    case 'public':
      return true;
    case 'school':
      return row.school === identity.school;
    case 'class':
      return (identity.memberships || []).some(
        (m) => m.instructor === row.instructor && m.period === row.period
      );
    case 'me':
      return row.ownerCode === identity.studentCode;
    default:
      // Real backend rows have no visibility field yet → show them.
      return true;
  }
}
