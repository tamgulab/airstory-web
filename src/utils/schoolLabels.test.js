import {
  resolveDirectorySchool,
  schoolAbbreviationCandidates,
  schoolLabelsMatch,
  shortLabelFromSchoolName,
} from './schoolLabels';

test('BXS matches Bronx High School of Science', () => {
  expect(schoolAbbreviationCandidates('Bronx High School of Science')).toEqual(
    expect.arrayContaining(['BS', 'BXS'])
  );
  expect(schoolLabelsMatch('BXS', 'Bronx High School of Science')).toBe(true);
  expect(schoolLabelsMatch('Bronx High School of Science', 'BXS')).toBe(true);
  expect(schoolLabelsMatch('bxs', 'Bronx High School of Science')).toBe(true);
});

test('CVA matches Chu Văn An High School, not Central High School', () => {
  expect(schoolAbbreviationCandidates('Chu Văn An High School')).toEqual(
    expect.arrayContaining(['CVA'])
  );
  expect(schoolAbbreviationCandidates('Chu Van An High School')).toEqual(
    expect.arrayContaining(['CVA'])
  );
  expect(schoolAbbreviationCandidates('CVA')).toEqual(['CVA']);
  expect(schoolLabelsMatch('CVA', 'Chu Văn An High School')).toBe(true);
  expect(schoolLabelsMatch('CVA', 'Chu Van An High School')).toBe(true);
  expect(schoolLabelsMatch('CVA', 'Central High School')).toBe(false);
});

test('short pin label still uses High/School initials for display', () => {
  expect(shortLabelFromSchoolName('Abraham Lincoln High School')).toBe('ALHS');
  expect(shortLabelFromSchoolName('Bronx High School of Science')).toBe('BHSS');
});

test('does not falsely match unrelated schools', () => {
  expect(schoolLabelsMatch('BXS', 'Abraham Lincoln High School')).toBe(false);
  expect(schoolLabelsMatch('Central High School', 'Brooklyn Technical High School')).toBe(false);
});

test('resolveDirectorySchool uses GPS to pick Vietnam campus for CVA', () => {
  const directory = [
    { id: 'central', name: 'Central High School', latitude: 40.0361, longitude: -75.1472 },
    { id: 'cva', name: 'Chu Văn An High School', latitude: 21.0433, longitude: 105.8334 },
  ];
  const match = resolveDirectorySchool({
    label: 'CVA',
    latitude: 21.0285,
    longitude: 105.8542,
    directory,
  });
  expect(match?.id).toBe('cva');
  expect(match?.name).toBe('Chu Văn An High School');
});

test('resolveDirectorySchool GPS-only labels a nearby campus when code is unknown', () => {
  const directory = [
    { id: 'cva', name: 'Chu Văn An High School', latitude: 21.0433, longitude: 105.8334 },
    { id: 'bxs', name: 'Bronx High School of Science', latitude: 40.8783, longitude: -73.8907 },
  ];
  const match = resolveDirectorySchool({
    label: 'UNKNOWN',
    latitude: 21.04,
    longitude: 105.83,
    directory,
  });
  expect(match?.id).toBe('cva');
});
