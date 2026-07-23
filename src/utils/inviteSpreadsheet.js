import {
  normalizeGroupToken as normalizeGroup,
  normalizePeriodToken as normalizePeriod,
} from './classStructure';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_RE_GLOBAL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Unique emails from free-form paste (no period/group). */
export function extractInviteEmails(text) {
  const found = String(text || '').match(EMAIL_RE_GLOBAL) || [];
  const seen = new Set();
  const out = [];
  for (const raw of found) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export { normalizePeriod, normalizeGroup };

export function normalizeFullName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function splitCsvLine(line) {
  // Minimal CSV split: commas outside double quotes.
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells.map((c) => c.replace(/^"|"$/g, '').trim());
}

function headerIndex(headers, aliases) {
  const lower = headers.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
  for (const alias of aliases) {
    const key = alias.toLowerCase().replace(/[\s_-]+/g, '');
    const idx = lower.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** True when the first row is a header (email/period/group/name), including "email - period - group". */
export function looksLikeInviteHeader(cells) {
  if (!cells?.length) return false;
  if (headerIndex(cells, ['email', 'e-mail', 'mail']) >= 0) return true;
  const joined = cells.join(' ').toLowerCase();
  return /\bemail\b/.test(joined) && (/\bperiod\b/.test(joined) || /\bgroup\b/.test(joined) || /\bname\b/.test(joined));
}

/**
 * Parse a CSV/TXT student invite list.
 * Preferred headers: name, email, period, group (header row is skipped automatically).
 * Without headers, accepts "email,period,group" or "name,email,period,group" rows.
 * @returns {{ rows: Array<{email:string,period:string,groupCode:string,fullName:string}>, placedCount: number, namedCount: number }}
 */
export function parseInviteSpreadsheet(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { rows: [], placedCount: 0, namedCount: 0 };

  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = looksLikeInviteHeader(firstCells);
  const emailCol = hasHeader ? headerIndex(firstCells, ['email', 'e-mail', 'mail']) : -1;
  const periodCol = hasHeader
    ? headerIndex(firstCells, ['period', 'classperiod', 'class'])
    : -1;
  const groupCol = hasHeader
    ? headerIndex(firstCells, ['group', 'groupcode', 'group_code', 'team'])
    : -1;
  const nameCol = hasHeader
    ? headerIndex(firstCells, ['name', 'fullname', 'full_name', 'studentname', 'student'])
    : -1;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const seen = new Set();
  const rows = [];

  const pushRow = (email, period = '', groupCode = '', fullName = '') => {
    const emailMatch = String(email).match(EMAIL_RE);
    if (!emailMatch) return;
    const normalized = emailMatch[0].trim().toLowerCase();
    if (seen.has(normalized) || rows.length >= 50) return;
    seen.add(normalized);
    rows.push({
      email: normalized,
      period: normalizePeriod(period),
      groupCode: normalizeGroup(groupCode),
      fullName: normalizeFullName(fullName),
    });
  };

  for (const line of dataLines) {
    if (rows.length >= 50) break;
    const cells = splitCsvLine(line);

    if (hasHeader) {
      // Header without a clear email column (e.g. "email - period - group" one cell): try free-form.
      if (emailCol < 0) {
        for (const match of line.match(EMAIL_RE_GLOBAL) || []) pushRow(match);
        continue;
      }
      pushRow(
        cells[emailCol] || '',
        periodCol >= 0 ? cells[periodCol] || '' : '',
        groupCol >= 0 ? cells[groupCol] || '' : '',
        nameCol >= 0 ? cells[nameCol] || '' : ''
      );
      continue;
    }

    const first = String(cells[0] || '').trim();
    const second = String(cells[1] || '').trim();
    const firstEmail = first.match(EMAIL_RE)?.[0];
    const secondEmail = second.match(EMAIL_RE)?.[0];

    // name,email,period,group — name cell must not itself contain an email
    if (
      cells.length >= 2
      && secondEmail
      && secondEmail.toLowerCase() === second.toLowerCase()
      && !EMAIL_RE.test(first)
    ) {
      pushRow(second, cells[2] || '', cells[3] || '', first);
      continue;
    }

    // email,period,group
    if (cells.length >= 2 && firstEmail && firstEmail.toLowerCase() === first.toLowerCase()) {
      pushRow(first, cells[1] || '', cells[2] || '', '');
      continue;
    }

    for (const match of line.match(EMAIL_RE_GLOBAL) || []) {
      pushRow(match);
    }
  }

  const placedCount = rows.filter((r) => r.period || r.groupCode).length;
  const namedCount = rows.filter((r) => r.fullName).length;
  return { rows, placedCount, namedCount };
}
