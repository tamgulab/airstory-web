import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HeatMapDashboard from './HeatMapDashboard';
import { apiRequest } from '../api/http';
import { getSchools } from '../api/schools';
import { getImportedMeasurements } from '../utils/importedData';

jest.mock('react-map-gl/maplibre', () => {
  const ReactModule = require('react');
  const MapMock = ReactModule.forwardRef(({ children, onLoad }, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ flyTo: jest.fn(), fitBounds: jest.fn() }));
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

jest.mock('../utils/importedData', () => {
  const measurements = [
    {
      id: 'one',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.0401,
      longitude: -75.0312,
      pm25: 8,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'two',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.0404,
      longitude: -75.0316,
      pm25: 9,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'three',
      sessionId: 'walk-b',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.0410,
      longitude: -75.0305,
      pm25: 11,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
    {
      id: 'four',
      sessionId: 'walk-b',
      date: '2026-07-17',
      time: '10:08',
      latitude: 40.0413,
      longitude: -75.0308,
      pm25: 12,
      school: 'Test School',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
  ];
  return {
    isBlankHierarchyField: (value) => !String(value ?? '').trim(),
    getImportedMeasurements: jest.fn(() => measurements),
  };
});

const defaultMeasurements = [
  {
    id: 'one',
    sessionId: 'walk-a',
    date: '2026-07-17',
    time: '10:00',
    latitude: 40.0401,
    longitude: -75.0312,
    pm25: 8,
    school: 'Test School',
    instructor: 'Teacher',
    period: '1',
    group: 'A',
  },
  {
    id: 'two',
    sessionId: 'walk-a',
    date: '2026-07-17',
    time: '10:05',
    latitude: 40.0404,
    longitude: -75.0316,
    pm25: 9,
    school: 'Test School',
    instructor: 'Teacher',
    period: '1',
    group: 'A',
  },
  {
    id: 'three',
    sessionId: 'walk-b',
    date: '2026-07-17',
    time: '10:00',
    latitude: 40.0410,
    longitude: -75.0305,
    pm25: 11,
    school: 'Test School',
    instructor: 'Teacher',
    period: '1',
    group: 'B',
  },
  {
    id: 'four',
    sessionId: 'walk-b',
    date: '2026-07-17',
    time: '10:08',
    latitude: 40.0413,
    longitude: -75.0308,
    pm25: 12,
    school: 'Test School',
    instructor: 'Teacher',
    period: '1',
    group: 'B',
  },
];

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

beforeEach(() => {
  getImportedMeasurements.mockImplementation(() => defaultMeasurements);
  getSchools.mockResolvedValue({ schools: [] });
});

/** Trails/legend only appear after an explicit campus click. */
async function selectTestSchoolPin() {
  const pin = await waitFor(() => {
    const el = document.querySelector('[data-testid^="school-pin-"]');
    expect(el).toBeTruthy();
    return el;
  });
  fireEvent.click(pin);
  await waitFor(() => {
    expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  });
}

test('keeps student trails visible and loads OpenAQ only after heatmap is enabled', async () => {
  apiRequest.mockResolvedValue({ points: [] });

  render(<HeatMapDashboard {...dashboardProps} />);
  await selectTestSchoolPin();

  expect(screen.getByRole('button', { name: /heatmap off/i })).toBeInTheDocument();
  expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Philadelphia' })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /heatmap off/i }));

  expect(screen.getByRole('button', { name: /heatmap on/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Philadelphia' })).toBeInTheDocument();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/analytics/openaq/heatmap?')));
});

test('heatmap includes geotagged Raw Data even when OpenAQ returns nothing', async () => {
  apiRequest.mockResolvedValue({ points: [] });
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'vn-heat-1',
      location: 'Hanoi Park',
      latitude: 21.0285,
      longitude: 105.8542,
      pm25: 42,
      co: 0.4,
      temp: 30,
      humidity: 70,
      school: 'Chu Văn An',
      instructor: 'Lan',
      period: '1',
      group: '2',
      date: '2026-05-12',
      time: '10:00:00',
      capturedAt: '2026-05-12T10:00:00.000Z',
    },
  ]);

  render(<HeatMapDashboard {...dashboardProps} importedDataVersion={42} />);
  fireEvent.click(screen.getByRole('button', { name: /heatmap off/i }));

  await waitFor(() => {
    expect(screen.getByText(/your Raw Data measurements/i)).toBeInTheDocument();
  });
  expect(screen.queryByText(/No heatmap data/i)).not.toBeInTheDocument();
  expect(screen.getByTestId('source-air-quality-data')).toBeInTheDocument();
});

test('compares group trails across Group / Class / School scope', async () => {
  render(<HeatMapDashboard {...dashboardProps} />);
  await selectTestSchoolPin();

  const scope = screen.getByRole('group', { name: /trail compare scope/i });
  expect(scope).toBeInTheDocument();

  // Default Class scope: each group gets its own color.
  expect(screen.getByText('Class trails · by group')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('B')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^Group$/ }));
  expect(screen.getByText('Group trail')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.queryByText('B')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^School$/ }));
  expect(screen.getByText('School trails · by group')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('B')).toBeInTheDocument();
});

test('School / Class / Group tabs do not show trails until a campus is clicked', async () => {
  render(<HeatMapDashboard {...dashboardProps} />);

  expect(screen.queryByTestId('source-measurement-trail-data')).not.toBeInTheDocument();
  expect(screen.queryByText(/trails · by/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^World$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^School$/ }));
  expect(screen.queryByTestId('source-measurement-trail-data')).not.toBeInTheDocument();
  expect(screen.queryByText(/trails · by/i)).not.toBeInTheDocument();

  await selectTestSchoolPin();
  expect(screen.getByText(/trails · by/i)).toBeInTheDocument();
});

test('World hides trails; clicking a school pin switches to School and keeps that campus', async () => {
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-vietnam',
        name: 'Chu Văn An High School',
        latitude: 21.0433,
        longitude: 105.8334,
      },
      {
        id: 'school-nyc',
        name: 'Bronx Science',
        latitude: 40.8783,
        longitude: -73.8907,
      },
    ],
  });
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'vn-1',
      sessionId: 'vn',
      date: '2026-07-17',
      time: '10:00',
      latitude: 21.0434,
      longitude: 105.8335,
      pm25: 20,
      school: 'Chu Văn An High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'vn-2',
      sessionId: 'vn',
      date: '2026-07-17',
      time: '10:05',
      latitude: 21.0436,
      longitude: 105.8337,
      pm25: 22,
      school: 'Chu Văn An High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'ny-1',
      sessionId: 'ny',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.8784,
      longitude: -73.8908,
      pm25: 9,
      school: 'Bronx Science',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
    {
      id: 'ny-2',
      sessionId: 'ny',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.8786,
      longitude: -73.891,
      pm25: 10,
      school: 'Bronx Science',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
  ]);

  render(
    <HeatMapDashboard
      {...dashboardProps}
      filters={{ ...dashboardProps.filters, school: 'Chu Văn An High School', group: 'A' }}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /^World$/ }));
  expect(screen.getByRole('button', { name: /^World$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByTestId('source-measurement-trail-data')).not.toBeInTheDocument();
  expect(screen.queryByText(/trails · by/i)).not.toBeInTheDocument();

  const vietnamPin = await waitFor(() => {
    const el = screen.getByTestId('school-pin-school-vietnam');
    expect(el).toBeInTheDocument();
    return el;
  });
  fireEvent.click(vietnamPin);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^World$/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^School$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  });
  expect(screen.getByTestId('school-pin-school-vietnam')).toHaveAttribute('aria-pressed', 'true');
  // Focused Vietnam school must not pull in New York trails / legend entries.
  expect(screen.queryByText('B')).not.toBeInTheDocument();
});

test('keeps trails when profile school name does not match CSV school code', async () => {
  render(
    <HeatMapDashboard
      {...dashboardProps}
      filters={{ ...dashboardProps.filters, school: 'Bronx High School Of Science' }}
    />
  );

  await selectTestSchoolPin();
  expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
});

test('graduation cap returns to your starred home school with full name popup', async () => {
  const onOpenRawData = jest.fn();
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-lincoln',
        name: 'Abraham Lincoln High School',
        latitude: 40.0401,
        longitude: -75.0312,
      },
    ],
  });
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'one',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.0402,
      longitude: -75.0313,
      pm25: 8,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'two',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.0404,
      longitude: -75.0315,
      pm25: 9,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
  ]);

  render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-lincoln"
      filters={{ ...dashboardProps.filters, school: 'Abraham Lincoln High School' }}
      importedDataVersion={7}
      onOpenRawData={onOpenRawData}
    />
  );

  await waitFor(() => {
    expect(screen.getByTestId('school-pin-school-lincoln')).toBeInTheDocument();
  });
  // Pins show initials only until clicked (full name lives in the popup).
  expect(screen.queryByText('Abraham Lincoln High School')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^World$/ }));
  expect(screen.queryByTestId('source-measurement-trail-data')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Center map on your school' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^School$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('source-measurement-trail-data')).toBeInTheDocument();
  });
  expect(screen.getAllByText('Abraham Lincoln High School').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('Your school')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^Raw Data$/ }));
  expect(onOpenRawData).toHaveBeenCalledWith({
    schoolName: 'Abraham Lincoln High School',
    schoolDataLabel: 'Abraham Lincoln High School',
  });
});

test('shows the current-location marker after geolocation succeeds', async () => {
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

test('only pins schools that appear in raw data, using directory coords when matched', async () => {
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-abraham-lincoln',
        name: 'Abraham Lincoln High School',
        latitude: 40.0401,
        longitude: -75.0312,
      },
      {
        id: 'school-unused',
        name: 'Unused Directory School',
        latitude: 34.05,
        longitude: -118.25,
      },
    ],
  });
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'one',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.0402,
      longitude: -75.0313,
      pm25: 8,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'two',
      sessionId: 'walk-a',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.0404,
      longitude: -75.0315,
      pm25: 9,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
  ]);

  const { container } = render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-abraham-lincoln"
      filters={{ ...dashboardProps.filters, school: 'Abraham Lincoln High School' }}
      importedDataVersion={99}
    />
  );

  await waitFor(() => {
    expect(document.querySelector('[aria-label="Show Abraham Lincoln High School"]')).toBeTruthy();
  });
  expect(document.querySelector('[aria-label="Show Unused Directory School"]')).toBeNull();
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
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'vn-1',
      sessionId: 'vn',
      date: '2026-07-17',
      time: '10:00',
      latitude: 21.0434,
      longitude: 105.8335,
      pm25: 20,
      school: 'Chu Văn An High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
  ]);
  apiRequest.mockResolvedValue({ points: [] });

  render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-chu-van-an"
      filters={{ ...dashboardProps.filters, school: 'Chu Văn An High School' }}
    />
  );

  await waitFor(() => {
    expect(document.querySelector('[aria-label="Show Chu Văn An High School"]')).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: /heatmap off/i }));

  await waitFor(() => {
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('lat=21.0278'));
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('lng=105.8342'));
  });
});

test('World scope + prev/next browse schools that have raw data', async () => {
  getSchools.mockResolvedValue({
    schools: [
      {
        id: 'school-a',
        name: 'Abraham Lincoln High School',
        latitude: 40.0401,
        longitude: -75.0312,
      },
      {
        id: 'school-b',
        name: 'Bronx Science',
        latitude: 40.8783,
        longitude: -73.8907,
      },
    ],
  });
  getImportedMeasurements.mockImplementation(() => [
    {
      id: 'a1',
      sessionId: 'a',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.0402,
      longitude: -75.0313,
      pm25: 8,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'a2',
      sessionId: 'a',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.0404,
      longitude: -75.0315,
      pm25: 9,
      school: 'Abraham Lincoln High School',
      instructor: 'Teacher',
      period: '1',
      group: 'A',
    },
    {
      id: 'b1',
      sessionId: 'b',
      date: '2026-07-17',
      time: '10:00',
      latitude: 40.8784,
      longitude: -73.8908,
      pm25: 11,
      school: 'Bronx Science',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
    {
      id: 'b2',
      sessionId: 'b',
      date: '2026-07-17',
      time: '10:05',
      latitude: 40.8786,
      longitude: -73.891,
      pm25: 12,
      school: 'Bronx Science',
      instructor: 'Teacher',
      period: '1',
      group: 'B',
    },
  ]);

  render(
    <HeatMapDashboard
      {...dashboardProps}
      schoolId="school-a"
      filters={{ ...dashboardProps.filters, school: 'Abraham Lincoln High School' }}
    />
  );

  await waitFor(() => {
    expect(document.querySelector('[aria-label="Show Abraham Lincoln High School"]')).toBeTruthy();
    expect(document.querySelector('[aria-label="Show Bronx Science"]')).toBeTruthy();
  });

  fireEvent.click(screen.getByRole('button', { name: /^World$/ }));
  expect(screen.getByRole('button', { name: /^World$/ })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Next school' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^School$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[aria-label="Show Abraham Lincoln High School"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  fireEvent.click(screen.getByRole('button', { name: 'Next school' }));
  await waitFor(() => {
    expect(document.querySelector('[aria-label="Show Bronx Science"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
