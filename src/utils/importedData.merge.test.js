import { mergeImportedMeasurementRows } from './importedData';

test('mergeImportedMeasurementRows keeps prior schools when importing another CSV', () => {
  const existing = [
    {
      sessionId: 'nyc',
      capturedAt: '2026-05-12T11:00:00.000Z',
      date: '2026-05-12',
      time: '11:00:00',
      school: 'BXS',
      instructor: 'Jiin Hur',
      period: '1',
      group: '1',
      location: 'lab',
      latitude: 40.87,
      longitude: -73.89,
    },
  ];
  const incoming = [
    {
      sessionId: 'vn',
      capturedAt: '2026-05-13T08:00:00.000Z',
      date: '2026-05-13',
      time: '08:00:00',
      school: 'Hanoi Demo',
      instructor: 'Lan',
      period: '2',
      group: '1',
      location: 'park',
      latitude: 21.02,
      longitude: 105.83,
    },
  ];

  const merged = mergeImportedMeasurementRows(existing, incoming);
  expect(merged).toHaveLength(2);
  expect(merged.map((r) => r.school).sort()).toEqual(['BXS', 'Hanoi Demo']);
});

test('mergeImportedMeasurementRows does not duplicate the same row', () => {
  const row = {
    sessionId: 'nyc',
    capturedAt: '2026-05-12T11:00:00.000Z',
    school: 'BXS',
    instructor: 'Jiin',
    period: '1',
    group: '1',
    location: 'lab',
    latitude: 40.87,
    longitude: -73.89,
  };
  expect(mergeImportedMeasurementRows([row], [row])).toHaveLength(1);
});
