/**
 * DEV ONLY - MOCK DATA - REMOVE BEFORE DEPLOY
 *
 * Mock data for the Manage Classes teacher console, consistent with the
 * mockMeasurements.js world: school LINCOLN, teacher Ms. Rivera, periods P3 & P5,
 * groups G1–G4. Deterministic (no Math.random).
 *
 * Accounts are a mix: most are individually-registered students with real first/last
 * names; one or two are name-less SHARED/legacy accounts (group members rotate through
 * one login) — those fall back to the username in the Name column. One group (P5 · G4)
 * has no account so the "No account" coverage warning shows.
 *
 * TODO(backend): roster / join-codes / class-structure come from the teacher endpoints
 * (getRoster, getJoinCodes, getClassStructure). Visibility enum is public | school | group;
 * 'class'/'me' reserved for a future researcher mode.
 */

export { MOCK_DATA_ENABLED } from './mockMeasurements';

export const MOCK_CLASS_STRUCTURE = {
  school: 'LINCOLN',
  teacher: 'Ms. Rivera',
  periods: ['P3', 'P5'],
  // Per-period group counts — periods can differ (P3 has 3 groups, P5 has 6).
  groupCounts: { P3: 3, P5: 6 },
  defaultVisibility: 'group', // public | school | group
};

const pad = (n) => String(n).padStart(2, '0');

// period, group, username, full_name ('' = shared/legacy account → username fallback in Name)
// P3 has 3 groups (G1–G3), P5 has 6 (G1–G6). P5·G6 is empty → coverage "8 of 9".
const ACCOUNTS = [
  { period: 'P3', group: 'G1', username: 'ava.martinez', full_name: 'Ava Martinez' },
  { period: 'P3', group: 'G1', username: 'lincoln-p3-g1', full_name: '' }, // shared
  { period: 'P3', group: 'G2', username: 'liam.chen', full_name: 'Liam Chen' },
  { period: 'P3', group: 'G3', username: 'noah.patel', full_name: 'Noah Patel' },
  { period: 'P5', group: 'G1', username: 'olivia.brown', full_name: 'Olivia Brown' },
  { period: 'P5', group: 'G2', username: 'sophia.garcia', full_name: 'Sophia Garcia' },
  { period: 'P5', group: 'G2', username: 'mason.lee', full_name: 'Mason Lee' },
  { period: 'P5', group: 'G3', username: 'lincoln-p5-g3', full_name: '' }, // shared
  { period: 'P5', group: 'G4', username: 'emma.davis', full_name: 'Emma Davis' },
  { period: 'P5', group: 'G5', username: 'lucas.kim', full_name: 'Lucas Kim' },
  // P5 · G6 intentionally has no account (coverage gap).
];

export const MOCK_ROSTER = ACCOUNTS.map((a, i) => ({
  id: `acct-${a.period}-${a.group}-${i}`,
  username: a.username,
  full_name: a.full_name,
  email: `${a.username}@lincoln.mock`,
  role: 'student',
  period: a.period,
  group_code: a.group,
  joined_at: `2026-06-${pad(2 + ((i * 3) % 18))}`,
}));

export const MOCK_JOIN_CODES = [
  { id: 'jc-p3', code: 'P3RVK', period: 'P3', school_code: 'LINCOLN', instructor: 'Ms. Rivera', active: true, created_at: '2026-06-01' },
  { id: 'jc-p5', code: 'P5RVM', period: 'P5', school_code: 'LINCOLN', instructor: 'Ms. Rivera', active: false, created_at: '2026-06-02' },
];
