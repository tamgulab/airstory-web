/** English filler words skipped when building school initials / abbreviation candidates.
 * Do NOT skip "an" / "a" — names like "Chu Văn An" need the final An for CVA. */
const SCHOOL_LABEL_SKIP = new Set([
  'of',
  'the',
  'for',
  'and',
  'at',
  'in',
  'high',
  'school',
  'middle',
  'junior',
  'senior',
  'academy',
  'prep',
  'charter',
  'college',
  'university',
]);

function significantWords(name) {
  return String(name || '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ỹ]/.test(w) && !SCHOOL_LABEL_SKIP.has(w.toLowerCase()));
}

/** Short label for map pins, e.g. "Lincoln High School" -> "LHS" (keeps High/School for display initials). */
export function shortLabelFromSchoolName(name) {
  const displaySkip = new Set(['of', 'the', 'for', 'and', 'a', 'an', 'at', 'in']);
  const initials = String(name || '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ỹ]/.test(w) && !displaySkip.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');
  return initials.slice(0, 4) || 'SCH';
}

/**
 * Abbreviation candidates for a full school name or a short CSV code.
 * - "CVA" stays "CVA" (not first letter "C")
 * - "Chu Văn An High School" → CVA
 * - "Bronx High School of Science" → BXS (Bronx → BX via first+last letter)
 */
export function schoolAbbreviationCandidates(name) {
  const raw = String(name || '').trim();
  // CSV / directory school codes are already abbreviations — keep them intact.
  if (/^[A-Za-z0-9]{2,6}$/.test(raw)) {
    return [raw.toUpperCase()];
  }

  const words = significantWords(name);
  if (!words.length) return [];
  const out = new Set();
  const initials = words.map((w) => w[0].toUpperCase()).join('');
  // Ignore single-letter "abbreviations" — they false-match (CVA→C↔Central).
  if (initials.length >= 2) out.add(initials);

  const first = words[0];
  const first2 = first.slice(0, 2).toUpperCase();
  // Borough-style codes: Bronx → BX (first + last letter).
  const firstLast = (first[0] + first[first.length - 1]).toUpperCase();
  const restInitials = words
    .slice(1)
    .map((w) => w[0].toUpperCase())
    .join('');
  const lastInitial = words[words.length - 1][0].toUpperCase();

  if (words.length >= 2) {
    const add = (s) => {
      if (s && s.length >= 2) out.add(s);
    };
    add(`${first2}${restInitials}`);
    add(`${firstLast}${restInitials}`);
    add(`${first2}${lastInitial}`);
    add(`${firstLast}${lastInitial}`);
  }
  return [...out];
}

/** Soft match for school codes vs directory names (e.g. BXS ↔ Bronx High School of Science). */
export function schoolLabelsMatch(a, b) {
  const left = String(a ?? '').trim().toLowerCase();
  const right = String(b ?? '').trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const compact = (s) => s.replace(/[^a-z0-9]/g, '');
  const leftC = compact(left);
  const rightC = compact(right);
  if (leftC && rightC && leftC === rightC) return true;

  const leftAbbrs = schoolAbbreviationCandidates(a)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length >= 2);
  const rightAbbrs = schoolAbbreviationCandidates(b)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length >= 2);
  if (leftAbbrs.some((x) => rightAbbrs.includes(x))) return true;
  if (leftC.length >= 2 && leftC.length <= 6 && rightAbbrs.includes(leftC)) return true;
  if (rightC.length >= 2 && rightC.length <= 6 && leftAbbrs.includes(rightC)) return true;

  const initialsLeft = shortLabelFromSchoolName(a).toLowerCase();
  const initialsRight = shortLabelFromSchoolName(b).toLowerCase();
  // Require 2+ chars so "C" (from code CVA) never equals a weak single initial.
  if (
    initialsLeft.length >= 2 &&
    initialsRight.length >= 2 &&
    initialsLeft === initialsRight
  ) {
    return true;
  }
  return false;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two WGS84 points. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const aLat = toRad(lat1);
  const bLat = toRad(lat2);
  const dLat = bLat - aLat;
  const dLng = toRad(lng2) - toRad(lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function schoolHasCoords(school) {
  return (
    Number.isFinite(Number(school?.latitude)) &&
    Number.isFinite(Number(school?.longitude))
  );
}

function nearestSchool(schools, lat, lng) {
  let best = null;
  let bestKm = Infinity;
  schools.forEach((school) => {
    if (!schoolHasCoords(school)) return;
    const km = distanceKm(lat, lng, Number(school.latitude), Number(school.longitude));
    if (km < bestKm) {
      bestKm = km;
      best = school;
    }
  });
  return best ? { school: best, km: bestKm } : null;
}

/**
 * Resolve a CSV school label to a directory school using name/code match,
 * disambiguated (or filled in) by GPS centroid of that label's raw-data points.
 */
export function resolveDirectorySchool({
  label,
  latitude,
  longitude,
  directory = [],
  /** Max distance to accept a GPS-only (no name match) assignment. */
  maxGpsOnlyKm = 30,
}) {
  const list = Array.isArray(directory) ? directory : [];
  const nameMatches = list.filter((school) => schoolLabelsMatch(school.name, label));
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng);

  if (nameMatches.length === 1) {
    // Still prefer GPS if the sole name match is absurdly far from the samples
    // (wrong false-positive code match) and another campus is nearby.
    if (hasGps && schoolHasCoords(nameMatches[0])) {
      const namedKm = distanceKm(
        lat,
        lng,
        Number(nameMatches[0].latitude),
        Number(nameMatches[0].longitude)
      );
      if (namedKm > maxGpsOnlyKm) {
        const nearby = nearestSchool(list, lat, lng);
        if (nearby && nearby.km <= maxGpsOnlyKm) return nearby.school;
      }
    }
    return nameMatches[0];
  }

  if (nameMatches.length > 1 && hasGps) {
    const nearby = nearestSchool(nameMatches, lat, lng);
    if (nearby) return nearby.school;
    return nameMatches[0];
  }

  if (nameMatches.length > 1) return nameMatches[0];

  // No name/code match — assign the nearest catalog school when GPS is on campus.
  if (hasGps) {
    const nearby = nearestSchool(list, lat, lng);
    if (nearby && nearby.km <= maxGpsOnlyKm) return nearby.school;
  }

  return null;
}
