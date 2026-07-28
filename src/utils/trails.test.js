import {
  buildTeamTrailSegments,
  dedupeConsecutivePath,
  distanceMeters,
  preferPointsNearSchool,
  splitIntoTrailSegments,
} from './trails';

test('does not draw one segment across a Philly–NYC GPS jump', () => {
  const philly = {
    lat: 40.04,
    lng: -75.03,
    timestamp: new Date('2026-06-01T13:00:00Z'),
    date: '2026-06-01',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };
  const nyc = {
    lat: 40.81,
    lng: -73.96,
    timestamp: new Date('2026-06-01T13:05:00Z'),
    date: '2026-06-01',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };

  expect(distanceMeters(philly, nyc)).toBeGreaterThan(100000);
  const { segments, markers } = buildTeamTrailSegments([philly, nyc], { trailScope: 'class' });
  expect(segments).toHaveLength(0);
  expect(markers.length).toBeGreaterThanOrEqual(1);
});

test('connects same-day team spots in time order even across sessions', () => {
  const classroom = {
    lat: 40.8783,
    lng: -73.8907,
    timestamp: new Date('2026-05-07T10:00:00Z'),
    date: '2026-05-07',
    sessionId: 's-class',
    school: 'PHG01',
    instructor: 'Jiin Hur',
    period: '1',
    group: '1',
  };
  const hallway = {
    lat: 40.8786,
    lng: -73.8910,
    timestamp: new Date('2026-05-07T11:30:00Z'),
    date: '2026-05-07',
    sessionId: 's-hall',
    school: 'PHG01',
    instructor: 'Jiin Hur',
    period: '1',
    group: '1',
  };

  const { segments, markers } = buildTeamTrailSegments([classroom, hallway], { trailScope: 'class' });
  expect(segments).toHaveLength(1);
  expect(segments[0].path).toHaveLength(2);
  expect(markers).toHaveLength(0);
});

test('keeps separate days as separate trail segments', () => {
  const day1a = {
    lat: 40.0401,
    lng: -75.0312,
    timestamp: new Date('2026-06-01T13:00:00Z'),
    date: '2026-06-01',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };
  const day1b = {
    lat: 40.0403,
    lng: -75.0314,
    timestamp: new Date('2026-06-01T13:03:00Z'),
    date: '2026-06-01',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };
  const day2a = {
    lat: 40.0405,
    lng: -75.0320,
    timestamp: new Date('2026-06-10T09:30:00Z'),
    date: '2026-06-10',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };
  const day2b = {
    lat: 40.0407,
    lng: -75.0322,
    timestamp: new Date('2026-06-10T09:32:00Z'),
    date: '2026-06-10',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: 'G1',
  };

  const { segments } = buildTeamTrailSegments([day1a, day1b, day2a, day2b], { trailScope: 'class' });
  expect(segments).toHaveLength(2);
});

test('draws a trail for every group that has geotagged points', () => {
  const mk = (group, lat, lng, period = '1') => ({
    lat,
    lng,
    timestamp: new Date('2026-05-07T10:00:00Z'),
    date: '2026-05-07',
    school: 'PHG01',
    instructor: 'Jiin Hur',
    period,
    group,
  });
  const points = [
    mk('1', 40.878, -73.891),
    mk('1', 40.8783, -73.8907),
    mk('2', 40.8785, -73.8905),
    mk('2', 40.8788, -73.8902),
    mk('3', 40.8790, -73.8900),
    mk('3', 40.8792, -73.8898),
  ];
  const { segments, markers, colorKeyOrder } = buildTeamTrailSegments(points, { trailScope: 'class' });
  expect(segments).toHaveLength(3);
  expect(markers).toHaveLength(0);
  // Class scope: each group gets its own color.
  expect(colorKeyOrder).toHaveLength(3);
  expect(colorKeyOrder.every((key) => key.startsWith('group:'))).toBe(true);

  const groupScoped = buildTeamTrailSegments(points, { trailScope: 'group' });
  expect(groupScoped.colorKeyOrder).toHaveLength(3);

  const schoolScoped = buildTeamTrailSegments(
    [
      ...points,
      mk('1', 40.88, -73.89, '2'),
      mk('1', 40.8802, -73.8898, '2'),
      {
        ...mk('1', 40.881, -73.889, '1'),
        instructor: 'Ms. Rivera',
      },
      {
        ...mk('1', 40.8812, -73.8888, '1'),
        instructor: 'Ms. Rivera',
      },
    ],
    { trailScope: 'school' }
  );
  // School scope: still one color per group (no instructor legend clutter).
  expect(schoolScoped.colorKeyOrder).toHaveLength(5);
  expect(schoolScoped.colorKeyOrder.every((key) => key.startsWith('group:'))).toBe(true);
});

test('static GPS sessions become markers instead of invisible zero-length lines', () => {
  const a = {
    lat: 40.0401,
    lng: -75.0312,
    timestamp: new Date('2026-06-01T13:00:00Z'),
    date: '2026-06-01',
    sessionId: 's1',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: '1',
  };
  const b = {
    lat: 40.0401,
    lng: -75.0312,
    timestamp: new Date('2026-06-01T13:01:00Z'),
    date: '2026-06-01',
    sessionId: 's1',
    school: 'LINCOLN',
    instructor: 'Ms. Rivera',
    period: 'P3',
    group: '1',
  };

  expect(dedupeConsecutivePath([a, b])).toHaveLength(1);
  const { segments, markers } = buildTeamTrailSegments([a, b], { trailScope: 'class' });
  expect(segments).toHaveLength(0);
  expect(markers).toHaveLength(1);
});

test('falls back to all points when none are near the school pin', () => {
  const points = [
    { lat: 40.04, lng: -75.03 },
    { lat: 40.041, lng: -75.031 },
  ];
  const schoolPin = { lat: 40.88, lng: -73.89 };
  expect(preferPointsNearSchool(points, schoolPin)).toEqual(points);
});

test('splitIntoTrailSegments keeps single-point leftovers for marker conversion', () => {
  const only = {
    lat: 40.04,
    lng: -75.03,
    timestamp: new Date('2026-06-01T13:00:00Z'),
  };
  expect(splitIntoTrailSegments([only])).toHaveLength(1);
});
