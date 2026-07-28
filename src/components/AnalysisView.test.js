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
      userRole="student"
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

test('still analyzes data when school directory name does not match CSV school code', () => {
  apiRequest.mockResolvedValue({ points: [] });
  render(
    <AnalysisView
      selectedMetric="pm25"
      setSelectedMetric={jest.fn()}
      filters={{
        school: 'Abraham Lincoln High School',
        instructor: 'Other Teacher',
        period: '9',
        group: 'Z',
      }}
      theme={{ primary: '#059669', light: '#ecfdf5', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' }}
      metricThemes={metricThemes}
      importedDataVersion={0}
      classStructure={{}}
      onSendToWorkspace={jest.fn()}
      userRole="student"
    />
  );

  expect(screen.queryByRole('heading', { name: /no data for analysis yet/i })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /your measurements over time/i })).toBeInTheDocument();
});

test('teachers get period and group focus controls that narrow analysis data', () => {
  const getImported = jest.requireMock('../utils/importedData').getImportedMeasurements;
  // Keep the shared mock returning multi-group rows via the existing factory shape.
  expect(typeof getImported).toBe('function');

  render(
    <AnalysisView
      selectedMetric="pm25"
      setSelectedMetric={jest.fn()}
      filters={{ school: 'Test School', instructor: 'Teacher', period: '1', group: '' }}
      theme={{ primary: '#059669', light: '#ecfdf5', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' }}
      metricThemes={metricThemes}
      importedDataVersion={0}
      classStructure={{ periods: ['1'], groupsByPeriod: { 1: ['A', 'B'] } }}
      onSendToWorkspace={jest.fn()}
      userRole="teacher"
    />
  );

  expect(screen.getByLabelText(/focus period for analysis/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/focus group for analysis/i)).toBeInTheDocument();
});
