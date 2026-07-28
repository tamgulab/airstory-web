import {
  compareHierarchyToken,
  dedupeHierarchyTokens,
  groupsEqual,
  groupsForPeriodFromStructure,
  normalizeGroupToken,
  normalizePeriodToken,
  periodsEqual,
  periodsFromClassStructure,
} from './classStructure';

describe('normalizePeriodToken / normalizeGroupToken', () => {
  test('collapses bare numbers and prefixes', () => {
    expect(normalizePeriodToken('1')).toBe('P1');
    expect(normalizePeriodToken('p1')).toBe('P1');
    expect(normalizeGroupToken('2')).toBe('G2');
    expect(normalizeGroupToken('Group 3')).toBe('G3');
  });
});

describe('dedupeHierarchyTokens', () => {
  test('merges 1 with P1 and 2 with G2', () => {
    expect(dedupeHierarchyTokens(['1', 'P1', 'P2', '2'], 'period')).toEqual(['P1', 'P2']);
    expect(dedupeHierarchyTokens(['1', 'G1', '2', 'G2', 'G3'], 'group')).toEqual(['G1', 'G2', 'G3']);
  });
});

describe('periodsEqual / groupsEqual', () => {
  test('treats bare and prefixed as equal', () => {
    expect(periodsEqual('1', 'P1')).toBe(true);
    expect(groupsEqual('2', 'G2')).toBe(true);
    expect(periodsEqual('P1', 'P2')).toBe(false);
  });
});

describe('periodsFromClassStructure / groupsForPeriodFromStructure', () => {
  test('normalizes periods and looks up groups under bare or P keys', () => {
    expect(periodsFromClassStructure({ periods: ['1', 'P1', 'P2'] })).toEqual(['P1', 'P2']);
    expect(groupsForPeriodFromStructure({ groupsByPeriod: { 1: ['1', 'G1', 'G2'] }, groupCount: 4 }, 'P1'))
      .toEqual(['G1', 'G2']);
    expect(groupsForPeriodFromStructure({ groupCount: 3 }, 'P1')).toEqual(['G1', 'G2', 'G3']);
  });

  test('sorts numerically', () => {
    expect(['P10', 'P2', 'P1'].sort(compareHierarchyToken)).toEqual(['P1', 'P2', 'P10']);
  });
});
