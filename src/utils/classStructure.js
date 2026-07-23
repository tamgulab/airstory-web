/** Normalize workspace class grid from API (periods + groupsByPeriod or counts only). */

/** Sort P1…P9 / G1…G9 numerically (not lexicographic P1, P10, P2). */
export function compareHierarchyToken(a, b) {
  const na = Number(String(a).replace(/\D/g, '')) || 0;
  const nb = Number(String(b).replace(/\D/g, '')) || 0;
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

/** "1" / "p1" / "Period 1" → "P1". Empty stays empty. */
export function normalizePeriodToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2})/);
  if (m) return `P${Number(m[1])}`;
  return s.toUpperCase().slice(0, 16);
}

/** "2" / "g2" / "Group 2" → "G2". Empty stays empty. */
export function normalizeGroupToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2})/);
  if (m) return `G${Number(m[1])}`;
  return s.toUpperCase().slice(0, 16);
}

/** Collapse "1"+"P1" (or "2"+"G2") into one canonical token list. */
export function dedupeHierarchyTokens(values, kind = 'period') {
  const normalize = kind === 'group' ? normalizeGroupToken : normalizePeriodToken;
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const n = normalize(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort(compareHierarchyToken);
}

export function periodsEqual(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return !sa && !sb;
  return normalizePeriodToken(sa) === normalizePeriodToken(sb);
}

export function groupsEqual(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return !sa && !sb;
  return normalizeGroupToken(sa) === normalizeGroupToken(sb);
}

function groupsByPeriodLookup(cs, period) {
  const map = cs?.groupsByPeriod;
  if (!map || !period) return null;
  const key = String(period).trim();
  if (Array.isArray(map[key])) return map[key];
  const canon = normalizePeriodToken(key);
  if (canon && Array.isArray(map[canon])) return map[canon];
  const bare = String(Number(String(key).replace(/\D/g, '')) || '');
  if (bare && Array.isArray(map[bare])) return map[bare];
  // Case-insensitive / soft key match (e.g. "p1" vs "P1")
  const hit = Object.keys(map).find((k) => periodsEqual(k, key));
  return hit && Array.isArray(map[hit]) ? map[hit] : null;
}

export function periodsFromClassStructure(cs) {
  if (!cs) return [];
  if (Array.isArray(cs.periods) && cs.periods.length) {
    return dedupeHierarchyTokens(cs.periods, 'period');
  }
  const n = Number(cs.periodCount);
  if (Number.isFinite(n) && n > 0) {
    return Array.from({ length: n }, (_, i) => `P${i + 1}`);
  }
  return [];
}

export function groupsForPeriodFromStructure(cs, period) {
  if (!cs || !period) return [];
  const fromMap = groupsByPeriodLookup(cs, period);
  if (Array.isArray(fromMap) && fromMap.length) {
    return dedupeHierarchyTokens(fromMap, 'group');
  }
  const n = Number(cs.groupCount);
  if (Number.isFinite(n) && n > 0) {
    return Array.from({ length: n }, (_, i) => `G${i + 1}`);
  }
  return [];
}
