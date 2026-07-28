import {
  extractInviteEmails,
  looksLikeInviteHeader,
  normalizeFullName,
  parseInviteSpreadsheet,
} from './inviteSpreadsheet';
import { normalizeGroupToken, normalizePeriodToken } from './classStructure';

describe('normalizePeriod / normalizeGroup via classStructure', () => {
  test('prefixes bare numbers', () => {
    expect(normalizePeriodToken('1')).toBe('P1');
    expect(normalizeGroupToken('2')).toBe('G2');
  });

  test('keeps P/G prefixes and extracts digits from labels', () => {
    expect(normalizePeriodToken('p3')).toBe('P3');
    expect(normalizeGroupToken('Group 4')).toBe('G4');
    expect(normalizePeriodToken('')).toBe('');
  });

  test('trims names', () => {
    expect(normalizeFullName('  Jiin   Hur ')).toBe('Jiin Hur');
  });
});

describe('looksLikeInviteHeader', () => {
  test('detects standard and dash-separated headers', () => {
    expect(looksLikeInviteHeader(['email', 'period', 'group'])).toBe(true);
    expect(looksLikeInviteHeader(['name', 'email', 'period', 'group'])).toBe(true);
    expect(looksLikeInviteHeader(['email - period - group'])).toBe(true);
    expect(looksLikeInviteHeader(['ava@school.edu', 'P1', 'G1'])).toBe(false);
  });
});

describe('parseInviteSpreadsheet', () => {
  test('skips header and reads name/email/period/group', () => {
    const text = [
      'name,email,period,group',
      'Ava Martinez,ava@school.edu,P1,G2',
      'Liam Chen,liam@school.edu,2,3',
    ].join('\n');
    const { rows, placedCount, namedCount } = parseInviteSpreadsheet(text);
    expect(placedCount).toBe(2);
    expect(namedCount).toBe(2);
    expect(rows).toEqual([
      { email: 'ava@school.edu', period: 'P1', groupCode: 'G2', fullName: 'Ava Martinez' },
      { email: 'liam@school.edu', period: 'P2', groupCode: 'G3', fullName: 'Liam Chen' },
    ]);
  });

  test('skips email/period/group header without name', () => {
    const text = ['email,period,group', 'ava@school.edu,P1,G2'].join('\n');
    const { rows } = parseInviteSpreadsheet(text);
    expect(rows).toEqual([
      { email: 'ava@school.edu', period: 'P1', groupCode: 'G2', fullName: '' },
    ]);
  });

  test('accepts headerless name,email,period,group rows', () => {
    const { rows } = parseInviteSpreadsheet('Noah Patel,noah@school.edu,P3,G1');
    expect(rows).toEqual([
      { email: 'noah@school.edu', period: 'P3', groupCode: 'G1', fullName: 'Noah Patel' },
    ]);
  });

  test('falls back to free-form emails without placement', () => {
    const { rows, placedCount } = parseInviteSpreadsheet('hello ava@school.edu thanks, liam@school.edu');
    expect(placedCount).toBe(0);
    expect(rows.map((r) => r.email)).toEqual(['ava@school.edu', 'liam@school.edu']);
  });

  test('dedupes emails and caps at 50', () => {
    const lines = ['email,period,group'];
    for (let i = 0; i < 60; i += 1) lines.push(`s${i}@school.edu,P1,G1`);
    lines.push('s0@school.edu,P2,G2');
    const { rows } = parseInviteSpreadsheet(lines.join('\n'));
    expect(rows).toHaveLength(50);
    expect(rows[0]).toEqual({ email: 's0@school.edu', period: 'P1', groupCode: 'G1', fullName: '' });
  });
});

describe('extractInviteEmails', () => {
  test('pulls unique emails from free text', () => {
    expect(extractInviteEmails('A@x.com, a@x.com\nb@y.org')).toEqual(['a@x.com', 'b@y.org']);
  });
});
