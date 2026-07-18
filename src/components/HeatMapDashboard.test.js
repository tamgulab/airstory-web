import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HeatMapDashboard from './HeatMapDashboard';
import { apiRequest } from '../api/http';
import { getSchools } from '../api/schools';

jest.mock('react-map-gl/maplibre', () => {
  const ReactModule = require('react');
  const MapMock = ReactModule.forwardRef(({ children, onLoad }, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ flyTo: jest.fn() }));
    ReactModule.useEffect(() => {
      onLoad?.();
    }, [onLoad]);
    return <div data-testid="map">{children}</div>;
  });
  return {
    __esModule: true,
    default: MapMock,
    FullscreenControl: () => null,
    Layer: () => null,
    Marker: ({ children, latitude, longitude }) => (
      <div data-testid="map-marker" data-latitude={latitude} data-longitude={longitude}>
        {children}
      </div>
    ),
    NavigationControl: () => null,
    Popup: ({ children }) => <>{children}</>,
    Source: ({ id, children }) => <div data-testid={`source-${id}`}>{children}</div>,
  };
});

jest.mock('../api/http', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('../api/schools', () => ({
  getSchools: jest.fn().mockResolvedValue({ schools: [] }),
}));

jest.mock('../utils/importedData', () => ({
  getImportedMeasurements: () => [
    {
      id: 'one',
      date: '2026-07-17',
      time: '10:00',
      latitude: 39.95,
      longitude: -75.16,
      pm25: 8,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'two',
      date: '2026-07-17',
      time: '10:05',
      latitude: 39.96,
      longitude: -75.15,
      pm25: 9,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
  ],
}));

const metricThemes = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', bg: 'bg-emerald-600' },
};

const dashboardProps = {
  workspaceKind: 'class',
  selectedMetric: 'pm25',
  setSelectedMetric: jest.fn(),
  filters: { school: 'Test School', instructor: 'Teacher', period: '1', group: 'A' },
  theme: { primary: '#059669', bg: 'bg-emerald-600' },
  metricThemes,
  importedDataVersion: 0,
};

test('keeps student trails visible and loads OpenAQ only after heatmap is enabled', async () => {
  getSchools.mockResolvedValue({ schools: [] });
  apiRequest.mockResolvedValue({ points: [] });

  render(<HeatMapDashboard {...dashboardProps} />);

  expect(screen.getByRole('button', { name: /heatmap off/i })).toBeInTheDocument();
  expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Philadelphia' })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /heatmap off/i }));

  expect(screen.getByRole('button', { name: /heatmap on/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Philadelphia' })).toBeInTheDocument();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/analytics/openaq/heatmap?')));
});

test('shows the current-location marker after geolocation succeeds', async () => {
  getSchools.mockResolvedValue({ schools: [] });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: jest.fn((onSuccess) => {
        onSuccess({ coords: { latitude: 39.97, longitude: -75.14 } });
      }),
    },
  });

  render(<HeatMapDashboard {...dashboardProps} />);
  fireEvent.click(screen.getByRole('button', { name: /center map on your location/i }));

  expect(await screen.findByLabelText('Your current location')).toBeInTheDocument();
});

test('uses the class school coordinates for every member viewing its map', async () => {
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-abraham-lincoln',
        name: 'Abraham Lincoln High School',
        latitude: 40.0401,
        longitude: -75.0312,
      },
    ],
  });

  const { container } = render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-abraham-lincoln"
      filters={{ ...dashboardProps.filters, school: 'Stale school label' }}
    />
  );

  expect(await screen.findByRole('button', { name: 'Show Abraham Lincoln High School' })).toBeInTheDocument();
  expect(container.querySelector('[data-latitude="40.0401"][data-longitude="-75.0312"]')).toBeInTheDocument();
});

test('defaults the OpenAQ reference city to the class school region', async () => {
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-chu-van-an',
        name: 'Chu Văn An High School',
        latitude: 21.0433,
        longitude: 105.8334,
      },
    ],
  });
  apiRequest.mockResolvedValue({ points: [] });

  render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-chu-van-an"
      filters={{ ...dashboardProps.filters, school: 'Chu Văn An High School' }}
    />
  );

  await screen.findByRole('button', { name: 'Show Chu Văn An High School' });
  fireEvent.click(screen.getByRole('button', { name: /heatmap off/i }));

  await waitFor(() => {
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('lat=21.0278'));
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('lng=105.8342'));
  });
});
