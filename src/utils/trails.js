/** Max gap between successive spots on one day's team trail (campus / block scale). */
export const MAX_TRAIL_STEP_METERS = 2000;

/** Prefer geotags near the class school pin, but never hide every trail if none are nearby. */
export const MAX_DISTANCE_FROM_SCHOOL_METERS = 8000;

/** Collapse only true GPS jitter — distinct rooms/yards stay as separate vertices. */
export const SAME_SPOT_METERS = 12;

/** Haversine distance in meters between two { lat, lng } points. */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Collapse consecutive duplicates so a static GPS session becomes one spot. */
export function dedupeConsecutivePath(path, minMoveMeters = SAME_SPOT_METERS) {
  if (!path.length) return [];
  const out = [path[0]];
  for (let i = 1; i < path.length; i += 1) {
    if (distanceMeters(out[out.length - 1], path[i]) >= minMoveMeters) {
      out.push(path[i]);
    }
  }
  return out;
}

/**
 * Split a time-sorted point list when a city-scale jump appears.
 * Same-day classroom → hallway hops stay connected (date-ordered trails).
 */
export function splitIntoTrailSegments(
  sortedPoints,
  { maxStepMeters = MAX_TRAIL_STEP_METERS } = {}
) {
  const segments = [];
  let current = [];

  sortedPoints.forEach((point) => {
    if (!current.length) {
      current.push(point);
      return;
    }
    const prev = current[current.length - 1];
    const dist = distanceMeters(prev, point);
    if (dist > maxStepMeters) {
      if (current.length >= 1) segments.push(current);
      current = [point];
      return;
    }
    current.push(point);
  });

  if (current.length >= 1) segments.push(current);
  return segments;
}

/**
 * Keep points near the school when possible; if that wipes everything, keep the original
 * set so trails still show (school pin / GPS region mismatch is common in demos).
 * Pass fallbackToAll: false when a school is explicitly focused so the map does not jump
 * to unrelated campuses (e.g. Vietnam pin → New York trails).
 */
export function preferPointsNearSchool(
  points,
  schoolPin,
  maxMeters = MAX_DISTANCE_FROM_SCHOOL_METERS,
  { fallbackToAll = true } = {}
) {
  if (!schoolPin || !points.length) return points;
  const nearby = points.filter(
    (point) =>
      distanceMeters(
        { lat: point.lat, lng: point.lng },
        { lat: schoolPin.lat, lng: schoolPin.lng }
      ) <= maxMeters
  );
  if (nearby.length) return nearby;
  return fallbackToAll ? points : [];
}

function pointDateKey(point) {
  if (point.date) return String(point.date);
  if (point.timestamp instanceof Date && !Number.isNaN(point.timestamp.getTime())) {
    return point.timestamp.toISOString().slice(0, 10);
  }
  return 'unknown-date';
}

/**
 * Color bucketing for Group / Class / School trail compare:
 * - group / class / school → each group gets its own color (paths stay distinct)
 * - world → no trails (handled by the dashboard)
 */
export function trailColorKey(point, trailScope = 'class') {
  const school = String(point.school ?? '').trim() || 'School';
  const instructor = String(point.instructor ?? '').trim() || 'Class';
  const period = String(point.period ?? '').trim() || 'Period';
  const group = String(point.group ?? '').trim() || 'Group';
  if (trailScope === 'world') return `world:${school}`;
  // School / class / group all color by group so campus trails stay readable.
  return `group:${school}|${instructor}|${period}|${group}`;
}

function trailLegendLabel(point, trailScope = 'class') {
  const group = String(point.group ?? '').trim() || 'Group';
  if (trailScope === 'world') return String(point.school ?? '').trim() || 'School';
  return group;
}

/**
 * Build colored trail geometry from geotagged measurement rows.
 *
 * One polyline per group per calendar day, vertices in time order — so classroom /
 * hallway / yard samples become a connected daily path instead of scattered dots.
 * Colors follow trailScope (group / class / school) while paths stay per-group.
 */
export function buildTeamTrailSegments(points, { trailScope = 'class' } = {}) {
  const byTeam = new Map();

  points.forEach((point) => {
    const groupLabel = String(point.group ?? '').trim() || 'Group';
    const teamKey = [point.school, point.instructor, point.period, groupLabel].join('|');
    const colorKey = trailColorKey({ ...point, group: groupLabel }, trailScope);
    const label = trailLegendLabel({ ...point, group: groupLabel }, trailScope);
    if (!byTeam.has(teamKey)) {
      byTeam.set(teamKey, { teamKey, colorKey, label, points: [] });
    }
    byTeam.get(teamKey).points.push({ ...point, group: groupLabel });
  });

  const colorKeyOrder = [...new Set([...byTeam.values()].map((team) => team.colorKey))].sort();
  const segments = [];
  const markers = [];

  byTeam.forEach((team) => {
    const byDate = new Map();
    team.points.forEach((point) => {
      const dayKey = pointDateKey(point);
      if (!byDate.has(dayKey)) byDate.set(dayKey, []);
      byDate.get(dayKey).push(point);
    });

    let segmentIndex = 0;
    [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, dayPoints]) => {
        const sorted = [...dayPoints].sort((a, b) => a.timestamp - b.timestamp);
        splitIntoTrailSegments(sorted).forEach((segment) => {
          const path = dedupeConsecutivePath(
            segment.map((point) => ({ lat: point.lat, lng: point.lng }))
          );
          if (path.length >= 2) {
            segments.push({
              teamKey: team.teamKey,
              segmentKey: `${team.teamKey}#${segmentIndex}`,
              colorKey: team.colorKey,
              label: team.label,
              path,
            });
            segmentIndex += 1;
          } else if (path.length === 1) {
            markers.push({
              teamKey: team.teamKey,
              markerKey: `${team.teamKey}#m${segmentIndex}`,
              colorKey: team.colorKey,
              label: team.label,
              lat: path[0].lat,
              lng: path[0].lng,
            });
            segmentIndex += 1;
          }
        });
      });
  });

  return { segments, markers, colorKeyOrder };
}
