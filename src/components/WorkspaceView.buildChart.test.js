import { buildChart, chartHasData, resolveChartKind } from './WorkspaceView';

const rows = [
  { group: '1', period: '1', pm25: 10, co: 0.4, date: '2026-05-01', school: 'PHG01', instructor: 'Jiin' },
  { group: '1', period: '1', pm25: 14, co: 0.5, date: '2026-05-01', school: 'PHG01', instructor: 'Jiin' },
  { group: '2', period: '1', pm25: 20, co: 0.6, date: '2026-05-02', school: 'PHG01', instructor: 'Jiin' },
  { group: '2', period: '1', pm25: 22, co: 0.7, date: '2026-05-02', school: 'PHG01', instructor: 'Jiin' },
];

test('auto suggests box for categorical x + numeric y', () => {
  expect(resolveChartKind('auto', 'group', 'pm25')).toBe('box');
});

test('builds a bar/box chart with one series per group', () => {
  const box = buildChart(rows, 'box', 'group', 'pm25', '#0EA5E9');
  expect(box.kind).toBe('box');
  expect(box.groups).toHaveLength(2);
  expect(chartHasData(box)).toBe(true);

  const bar = buildChart(rows, 'bar', 'group', 'pm25', '#0EA5E9');
  expect(bar.kind).toBe('bar');
  expect(bar.data).toHaveLength(2);
  expect(chartHasData(bar)).toBe(true);
});

test('builds a line chart from date + metric', () => {
  const line = buildChart(rows, 'line', 'date', 'pm25', '#0EA5E9');
  expect(line.kind).toBe('line');
  expect(line.data.length).toBeGreaterThan(0);
  expect(chartHasData(line)).toBe(true);
});

test('builds a scatter chart from two numeric columns', () => {
  const scatter = buildChart(rows, 'scatter', 'pm25', 'co', '#0EA5E9');
  expect(scatter.kind).toBe('scatter');
  expect(scatter.data).toHaveLength(4);
  expect(chartHasData(scatter)).toBe(true);
});

test('empty rows produce an empty (non-drawable) chart', () => {
  const empty = buildChart([], 'bar', 'group', 'pm25', '#0EA5E9');
  expect(chartHasData(empty)).toBe(false);
});
