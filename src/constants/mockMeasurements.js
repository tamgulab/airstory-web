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
// Realistic ranges: pm25 ~5–55 µg/m³, co ~0.2–1.6 ppm, temp ~18–29 °C, humidity ~38–72 %.
const RAW_MOCK_MEASUREMENTS = [
  // === Ms. Rivera · P3 (the student's class), Group G1 (the student's group) ===
  { id: 'm1', captured_at: '2026-06-01T13:12:00Z', session_id: 's1', session_code: 'R3G1-0601', session_name: 'Rivera P3 G1 Courtyard Walk', location_name: 'Main Courtyard', latitude: 40.8124, longitude: -73.9612, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 14, co: 0.5, temp: 21, humidity: 58, visibility: 'me', owner_student_code: 'DEV001' },
  { id: 'm2', captured_at: '2026-06-02T08:47:00Z', session_id: 's2', session_code: 'R3G1-0602', session_name: 'Rivera P3 G1 Gym', location_name: 'Gymnasium', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 23, co: 0.8, temp: 24, humidity: 49, visibility: 'public', owner_student_code: 'DEV001' },
  { id: 'm3', captured_at: '2026-06-04T14:05:00Z', session_id: 's3', session_code: 'R3G1-0604', session_name: 'Rivera P3 G1 Cafeteria', location_name: 'Cafeteria', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 31, co: 1.1, temp: 23, humidity: 61, visibility: 'class', owner_student_code: 'STU002' },
  { id: 'm4', captured_at: '2026-06-10T09:30:00Z', session_id: 's4', session_code: 'R3G1-0610', session_name: 'Rivera P3 G1 Entrance', location_name: 'Front Entrance', latitude: 40.8131, longitude: -73.9627, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G1', pm25: 9, co: 0.3, temp: 19, humidity: 66, visibility: 'school', owner_student_code: 'STU002' },

  // === Ms. Rivera · P3, Group G2 (same class, other group) ===
  { id: 'm5', captured_at: '2026-06-04T14:22:00Z', session_id: 's5', session_code: 'R3G2-0604', session_name: 'Rivera P3 G2 Library', location_name: 'Library', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 18, co: 0.6, temp: 22, humidity: 54, visibility: 'public', owner_student_code: 'STU003' },
  { id: 'm6', captured_at: '2026-06-05T10:15:00Z', session_id: 's6', session_code: 'R3G2-0605', session_name: 'Rivera P3 G2 Chem Lab', location_name: 'Chemistry Lab', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 44, co: 1.5, temp: 26, humidity: 42, visibility: 'me', owner_student_code: 'STU003' }, // hidden from DEV001 (me-only, not owner)
  { id: 'm7', captured_at: '2026-06-11T11:40:00Z', session_id: 's7', session_code: 'R3G2-0611', session_name: 'Rivera P3 G2 Art Studio', location_name: 'Art Studio', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P3', group_code: 'G2', pm25: 16, co: 0.5, temp: 22, humidity: 57, visibility: 'class', owner_student_code: 'STU004' },

  // === Ms. Rivera · P5 (same teacher, DIFFERENT period → NOT the student's class) ===
  { id: 'm8', captured_at: '2026-06-05T10:50:00Z', session_id: 's8', session_code: 'R5G1-0605', session_name: 'Rivera P5 G1 Band Room', location_name: 'Band Room', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G1', pm25: 27, co: 0.9, temp: 24, humidity: 47, visibility: 'class', owner_student_code: 'STU005' }, // hidden from DEV001 (class-only, P5 not the student's period)
  { id: 'm9', captured_at: '2026-06-12T13:05:00Z', session_id: 's9', session_code: 'R5G2-0612', session_name: 'Rivera P5 G2 Pool', location_name: 'Pool Deck', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G2', pm25: 12, co: 0.4, temp: 27, humidity: 70, visibility: 'public', owner_student_code: 'STU006' },
  { id: 'm10', captured_at: '2026-06-16T08:55:00Z', session_id: 's10', session_code: 'R5G1-0616', session_name: 'Rivera P5 G1 Aux Gym', location_name: 'Auxiliary Gym', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Ms. Rivera', period: 'P5', group_code: 'G1', pm25: 20, co: 0.7, temp: 23, humidity: 51, visibility: 'school', owner_student_code: 'STU005' },

  // === Mr. Chen · P2 (a DIFFERENT class, the student is not in it), Group G3 ===
  { id: 'm11', captured_at: '2026-06-05T15:20:00Z', session_id: 's11', session_code: 'C2G3-0605', session_name: 'Chen P2 G3 Field', location_name: 'Athletic Field', latitude: 40.8210, longitude: -73.9514, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G3', pm25: 8, co: 0.2, temp: 20, humidity: 63, visibility: 'class', owner_student_code: 'STU010' }, // hidden from DEV001 (class-only, not the student's class)
  { id: 'm12', captured_at: '2026-06-15T12:30:00Z', session_id: 's12', session_code: 'C2G3-0615', session_name: 'Chen P2 G3 Hallway', location_name: 'Main Hallway', indoor_outdoor: 'INDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G3', pm25: 35, co: 1.2, temp: 25, humidity: 45, visibility: 'public', owner_student_code: 'STU010' },

  // === Mr. Chen · P2, Group G4 (same class, other group) ===
  { id: 'm13', captured_at: '2026-06-17T13:45:00Z', session_id: 's13', session_code: 'C2G4-0617', session_name: 'Chen P2 G4 Lot', location_name: 'Parking Lot', latitude: 40.8228, longitude: -73.9521, indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G4', pm25: 52, co: 1.6, temp: 28, humidity: 38, visibility: 'school', owner_student_code: 'STU011' },
  { id: 'm14', captured_at: '2026-06-18T14:10:00Z', session_id: 's14', session_code: 'C2G4-0618', session_name: 'Chen P2 G4 Track', location_name: 'Running Track', indoor_outdoor: 'OUTDOOR', school_code: 'LINCOLN', instructor: 'Mr. Chen', period: 'P2', group_code: 'G4', pm25: 11, co: 0.3, temp: 21, humidity: 60, visibility: 'me', owner_student_code: 'STU011' }, // hidden from DEV001 (me-only, not owner)
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
