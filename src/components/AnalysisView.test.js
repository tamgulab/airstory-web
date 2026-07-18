import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalysisView from './AnalysisView';
import { apiRequest } from '../api/http';

jest.mock('recharts', () => {
  const ReactModule = require('react');
  const Wrapper = ({ children }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    LineChart: Wrapper,
    Line: Empty,
    BarChart: Wrapper,
    Bar: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Tooltip: Empty,
    ResponsiveContainer: Wrapper,
    Legend: Empty,
    ScatterChart: Wrapper,
    Scatter: Empty,
    CartesianGrid: Empty,
    ZAxis: Empty,
  };
});

jest.mock('../api/http', () => ({
  apiRequest: jest.fn().mockResolvedValue({ points: [] }),
}));

jest.mock('../utils/importedData', () => ({
  getImportedMeasurements: () => [
    {
      id: 'measurement-1',
      date: '2026-07-17',
      time: '10:00',
      pm25: 8,
      co: 0.2,
      temp: 24,
      humidity: 45,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
      location: 'School yard',
    },
  ],
  isBlankHierarchyField: (value) => value == null || value === '',
}));

const metricThemes = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', bg: 'bg-emerald-600' },
  co: { label: 'CO', unit: 'ppm', bg: 'bg-blue-600' },
  temp: { label: 'Temperature', unit: '°C', bg: 'bg-orange-600' },
  humidity: { label: 'Humidity', unit: '%', bg: 'bg-cyan-600' },
};

test('opens recent and trends by default and exposes one Compare Data tab', async () => {
  apiRequest.mockResolvedValue({ points: [] });
  render(
    <AnalysisView
      selectedMetric="pm25"
      setSelectedMetric={jest.fn()}
      filters={{ school: 'Test School', instructor: 'Teacher', period: '1', group: 'A' }}
      theme={{ primary: '#059669', light: '#ecfdf5', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' }}
      metricThemes={metricThemes}
      importedDataVersion={0}
      classStructure={{}}
      onSendToWorkspace={jest.fn()}
    />
  );

  expect(screen.getByRole('heading', { name: /recent week vs philadelphia/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /your measurements over time/i })).toBeInTheDocument();

  const compareButtons = screen.getAllByRole('button', { name: 'Compare Data' });
  expect(compareButtons).toHaveLength(1);
  await waitFor(() => expect(apiRequest).toHaveBeenCalled());
  fireEvent.click(compareButtons[0]);
  expect(screen.getByRole('heading', { name: /your recent week comparison/i })).toBeInTheDocument();
});
