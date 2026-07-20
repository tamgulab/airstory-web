import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  BarChart, Bar, CartesianGrid, Line, LineChart, Scatter, ScatterChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import {
  CheckSquare, Download, FileText, HelpCircle, LayoutGrid, Link2, Plus, Sparkles, Trash2, X,
} from 'lucide-react';
import { getImportedMeasurements, isBlankHierarchyField } from '../utils/importedData';
import { downloadElementAsPng } from './charts/SaveChartButton';
import BoxPlot from './charts/BoxPlot';
import ChartFrame from './charts/ChartFrame';

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1050;
const AXIS_PROPS = {
  stroke: '#94A3B8',
  style: { fontSize: '11px' },
  tickLine: true,
  axisLine: { stroke: '#94A3B8' },
};
const PLOT_MARGIN = { top: 8, right: 12, bottom: 8, left: 8 };

/** Post-it palette for Workspace notes (a few clear classroom colors, not a rainbow dump). */
const NOTE_COLORS = [
  {
    id: 'yellow', label: 'Yellow', swatch: '#FBBF24',
    body: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100/80', text: 'text-amber-950',
    export: { body: '#FFFBEB', header: '#FEF3C7', border: '#FDE68A', text: '#451A03', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
  {
    id: 'pink', label: 'Pink', swatch: '#FB7185',
    body: 'bg-rose-50', border: 'border-rose-200', header: 'bg-rose-100/80', text: 'text-rose-950',
    export: { body: '#FFF1F2', header: '#FFE4E6', border: '#FECDD3', text: '#4C0519', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
  {
    id: 'blue', label: 'Blue', swatch: '#38BDF8',
    body: 'bg-sky-50', border: 'border-sky-200', header: 'bg-sky-100/80', text: 'text-sky-950',
    export: { body: '#F0F9FF', header: '#E0F2FE', border: '#BAE6FD', text: '#082F49', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
  {
    id: 'green', label: 'Green', swatch: '#34D399',
    body: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100/80', text: 'text-emerald-950',
    export: { body: '#ECFDF5', header: '#D1FAE5', border: '#A7F3D0', text: '#022C22', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
  {
    id: 'lilac', label: 'Lilac', swatch: '#C084FC',
    body: 'bg-violet-50', border: 'border-violet-200', header: 'bg-violet-100/80', text: 'text-violet-950',
    export: { body: '#F5F3FF', header: '#EDE9FE', border: '#DDD6FE', text: '#2E1065', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
  {
    id: 'white', label: 'White', swatch: '#E2E8F0',
    body: 'bg-white', border: 'border-slate-200', header: 'bg-slate-50', text: 'text-slate-900',
    export: { body: '#FFFFFF', header: '#F8FAFC', border: '#E2E8F0', text: '#0F172A', soft: '#E0F2FE', softText: '#075985', softBorder: '#BAE6FD' },
  },
];

/** Shared accent so a note can point at “the blue chart” / “the violet chart” (Apple-style tag dots). */
const LINK_COLORS = [
  { id: 'sky', label: 'Sky', swatch: '#0284C7', soft: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'violet', label: 'Violet', swatch: '#7C3AED', soft: 'bg-violet-100 text-violet-800 border-violet-200' },
  { id: 'emerald', label: 'Green', swatch: '#059669', soft: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'amber', label: 'Amber', swatch: '#D97706', soft: 'bg-amber-100 text-amber-900 border-amber-200' },
  { id: 'rose', label: 'Rose', swatch: '#E11D48', soft: 'bg-rose-100 text-rose-800 border-rose-200' },
];

const noteColorFor = (id) => NOTE_COLORS.find((color) => color.id === id) || NOTE_COLORS[0];
const linkColorFor = (id) => LINK_COLORS.find((color) => color.id === id) || LINK_COLORS[0];

/** Snap distance (px) for magnetic note↔chart attach on the workspace canvas. */
const MAGNET_SNAP_PX = 110;
const MAGNET_GAP_PX = 14;

/** Park a note on the right edge of a chart (used for snap + follow). */
function parkNoteBesideChart(noteLayout, chartLayout) {
  const cl = chartLayout || { x: 0, y: 0, width: 370, height: 360 };
  return {
    ...noteLayout,
    x: Math.round(cl.x + cl.width + MAGNET_GAP_PX),
    y: Math.round(cl.y),
  };
}

function attachOffsetFor(noteLayout, chartLayout) {
  const cl = chartLayout || { x: 0, y: 0, width: 370, height: 360 };
  return {
    dx: Math.round(noteLayout.x - cl.x),
    dy: Math.round(noteLayout.y - cl.y),
  };
}

/** If a note is dropped near a chart, attach + park it on the chart's right edge. */
function magneticSnapForNote(noteLayout, charts) {
  let best = null;
  let bestScore = MAGNET_SNAP_PX;
  const noteCX = noteLayout.x + noteLayout.width / 2;
  const noteCY = noteLayout.y + noteLayout.height / 2;

  charts.forEach((chart) => {
    const cl = chart.layout || { x: 0, y: 0, width: 370, height: 360 };
    const chartRight = cl.x + cl.width;
    const chartBottom = cl.y + cl.height;
    const chartCX = cl.x + cl.width / 2;
    const chartCY = cl.y + cl.height / 2;
    const centerDist = Math.hypot(noteCX - chartCX, noteCY - chartCY);
    const edgeDist = Math.min(
      Math.hypot(noteLayout.x - chartRight, noteCY - chartCY),
      Math.hypot(noteCX - chartCX, noteLayout.y - chartBottom),
      Math.hypot(noteLayout.x + noteLayout.width - cl.x, noteCY - chartCY)
    );
    const score = Math.min(centerDist * 0.55, edgeDist);
    if (score < bestScore) {
      bestScore = score;
      const layout = parkNoteBesideChart(noteLayout, cl);
      best = {
        attachedToId: chart.id,
        layout,
        attachOffset: attachOffsetFor(layout, cl),
      };
    }
  });
  return best;
}

/**
 * When a chart moves/resizes, keep attached notes glued to its right edge.
 * Vertical offset (dy) is preserved so stacked notes can sit slightly apart.
 */
export function followAttachedNotes(items, chartId, chartLayout) {
  return items.map((entry) => {
    if (entry.kind !== 'note' || entry.attachedToId !== chartId) return entry;
    const noteLayout = entry.layout || { x: 20, y: 20, width: 320, height: 220 };
    const dy = entry.attachOffset?.dy ?? 0;
    const nextLayout = {
      ...noteLayout,
      x: Math.round(chartLayout.x + chartLayout.width + MAGNET_GAP_PX),
      y: Math.round(chartLayout.y + dy),
    };
    return {
      ...entry,
      layout: nextLayout,
      attachOffset: attachOffsetFor(nextLayout, chartLayout),
    };
  });
}

const NUMERIC_COLUMNS = [
  { key: 'pm25', label: 'PM 2.5', unit: 'µg/m³' },
  { key: 'co', label: 'CO', unit: 'ppm' },
  { key: 'temp', label: 'Temperature', unit: '°C' },
  { key: 'humidity', label: 'Humidity', unit: '%' },
];
const CATEGORICAL_COLUMNS = [
  { key: 'school', label: 'School' },
  { key: 'instructor', label: 'Class/Instructor' },
  { key: 'period', label: 'Period' },
  { key: 'group', label: 'Group' },
  { key: 'indoorOutdoor', label: 'Indoor/Outdoor' },
  { key: 'location', label: 'Location' },
  { key: 'date', label: 'Date' },
];
const ALL_COLUMNS = [...NUMERIC_COLUMNS, ...CATEGORICAL_COLUMNS];
const columnFor = (key) => ALL_COLUMNS.find((column) => column.key === key) || { key, label: key, unit: '' };
const isNumeric = (key) => NUMERIC_COLUMNS.some((column) => column.key === key);
const axisLabel = (key) => {
  const column = columnFor(key);
  return column.unit ? `${column.label} (${column.unit})` : column.label;
};

function averageByCategory(rows, categoryKey, valueKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const category = String(row[categoryKey] || 'Unknown');
    const value = Number(row[valueKey]);
    if (!Number.isFinite(value)) return;
    const aggregate = groups.get(category) || { sum: 0, count: 0 };
    aggregate.sum += value;
    aggregate.count += 1;
    groups.set(category, aggregate);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, aggregate]) => ({
      category,
      value: Number((aggregate.sum / aggregate.count).toFixed(2)),
    }));
}

function boxGroups(rows, categoryKey, valueKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const category = String(row[categoryKey] || 'Unknown');
    const value = Number(row[valueKey]);
    if (!Number.isFinite(value)) return;
    groups.set(category, [...(groups.get(category) || []), value]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, values]) => ({ label, values }));
}

function dateSeries(rows, valueKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const date = String(row.date || '');
    const value = Number(row[valueKey]);
    if (!date || !Number.isFinite(value)) return;
    const aggregate = groups.get(date) || { sum: 0, count: 0 };
    aggregate.sum += value;
    aggregate.count += 1;
    groups.set(date, aggregate);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, aggregate]) => ({
      date,
      value: Number((aggregate.sum / aggregate.count).toFixed(2)),
    }));
}

export function resolveChartKind(requested, xKey, yKey) {
  if (requested !== 'auto') return requested;
  if (isNumeric(xKey) && isNumeric(yKey)) return 'scatter';
  if (xKey === 'date' && isNumeric(yKey)) return 'line';
  if (!isNumeric(xKey) && isNumeric(yKey)) return 'box';
  return 'bar';
}

/** True when a built chart payload has something drawable. */
export function chartHasData(item) {
  if (!item || item.kind === 'note') return false;
  if (item.kind === 'box') {
    return (item.groups || []).some((group) => Array.isArray(group.values) && group.values.length > 0);
  }
  return Array.isArray(item.data) && item.data.length > 0;
}

export function buildChart(rows, requestedKind, xKey, yKey, color) {
  const kind = resolveChartKind(requestedKind, xKey, yKey);
  const xNumeric = isNumeric(xKey);
  const yNumeric = isNumeric(yKey);
  const xLabel = axisLabel(xKey);
  const yLabel = axisLabel(yKey);

  if (kind === 'scatter' && xNumeric && yNumeric) {
    return {
      kind,
      data: rows
        .map((row) => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      xLabel,
      yLabel,
      color,
    };
  }

  if (kind === 'line' && yNumeric) {
    return {
      kind,
      data: dateSeries(rows, yKey),
      xKey: 'date',
      xLabel: 'Date',
      yLabel,
      color,
      series: [{ dataKey: 'value', label: columnFor(yKey).label, color }],
    };
  }

  const categoryKey = xNumeric ? yKey : xKey;
  const valueKey = yNumeric ? yKey : xKey;
  if (kind === 'box' && isNumeric(valueKey)) {
    return {
      kind,
      groups: boxGroups(rows, categoryKey, valueKey),
      unit: columnFor(valueKey).unit || '',
      xLabel: axisLabel(categoryKey),
      yLabel: axisLabel(valueKey),
      color,
    };
  }

  if (isNumeric(valueKey)) {
    return {
      kind: 'bar',
      data: averageByCategory(rows, categoryKey, valueKey),
      xKey: 'category',
      xLabel: axisLabel(categoryKey),
      yLabel: `Average ${axisLabel(valueKey)}`,
      color,
    };
  }

  const counts = new Map();
  rows.forEach((row) => {
    const category = String(row[xKey] || 'Unknown');
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return {
    kind: 'bar',
    data: [...counts.entries()].map(([category, value]) => ({ category, value })),
    xKey: 'category',
    xLabel,
    yLabel: 'Count',
    color,
  };
}

function ChartContent({ item, noteTheme, plotHeight }) {
  if (item.kind === 'note') {
    const theme = noteTheme || noteColorFor(item.noteColor);
    return (
      <div
        data-export-note-body="true"
        className={`h-full whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed ${theme.body} ${theme.border} ${theme.text}`}
        style={{
          backgroundColor: theme.export.body,
          borderColor: theme.export.border,
          color: theme.export.text,
        }}
      >
        {item.content || 'Use Edit to write your report notes.'}
      </div>
    );
  }
  if (!chartHasData(item)) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center px-4 text-center text-sm text-gray-500">
        No rows match the current filters (or Raw Data is empty). Import measurements, then try again.
      </div>
    );
  }
  if (item.kind === 'box') {
    return (
      <BoxPlot
        groups={item.groups || []}
        unit={item.unit || ''}
        color={item.color}
        height={plotHeight || 200}
      />
    );
  }

  const series = item.series || [{ dataKey: 'value', label: 'Value', color: item.color || '#0EA5E9' }];
  const legendItems =
    series.length > 1 ? series.map((entry) => ({ label: entry.label, color: entry.color })) : [];

  return (
    <ChartFrame
      className={plotHeight ? undefined : 'h-full'}
      height={plotHeight}
      xLabel={item.xLabel || ''}
      yLabel={item.yLabel || ''}
      legendItems={legendItems}
    >
      <ResponsiveContainer width="100%" height="100%">
        {item.kind === 'scatter' ? (
          <ScatterChart margin={PLOT_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" dataKey="x" name={item.xLabel} {...AXIS_PROPS} />
            <YAxis type="number" dataKey="y" name={item.yLabel} {...AXIS_PROPS} />
            <ZAxis range={[55, 55]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={item.data || []} fill={item.color || '#0EA5E9'} fillOpacity={0.75} />
          </ScatterChart>
        ) : item.kind === 'bar' ? (
          <BarChart data={item.data || []} margin={PLOT_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={item.xKey || 'category'} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip />
            <Bar dataKey="value" fill={item.color || '#0EA5E9'} radius={[5, 5, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={item.data || []} margin={PLOT_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={item.xKey || 'date'} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip />
            {series.map((entry) => (
              <Line
                key={entry.dataKey}
                type="monotone"
                dataKey={entry.dataKey}
                name={entry.label}
                stroke={entry.color}
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function CanvasItem({
  item,
  selected,
  onSelect,
  onRemove,
  onUpdate,
  registerRef,
  chartOptions = [],
  linkedNotesCount = 0,
}) {
  const [editing, setEditing] = useState(false);
  const [pickingLinkColor, setPickingLinkColor] = useState(false);
  const linkPickerRef = useRef(null);
  const layout = item.layout || { x: 20, y: 20, width: 370, height: 310 };
  const isNote = item.kind === 'note';
  const noteTheme = noteColorFor(item.noteColor);
  const attachedChart = chartOptions.find((chart) => chart.id === item.attachedToId) || null;
  const attachedLink = attachedChart ? linkColorFor(attachedChart.linkColor) : null;
  const ownLink = !isNote ? linkColorFor(item.linkColor) : null;

  useEffect(() => {
    if (!pickingLinkColor) return undefined;
    const onPointerDown = (event) => {
      if (linkPickerRef.current && !linkPickerRef.current.contains(event.target)) {
        setPickingLinkColor(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pickingLinkColor]);

  const commitLayout = (nextLayout, { snapNote = false } = {}) => {
    if (!isNote) {
      onUpdate(item.id, { layout: nextLayout });
      return;
    }
    if (!snapNote || !chartOptions.length) {
      // Keep attachment + refresh offset if still linked; clear if user dragged far without snap.
      if (item.attachedToId) {
        const chart = chartOptions.find((entry) => entry.id === item.attachedToId);
        if (chart) {
          onUpdate(item.id, {
            layout: nextLayout,
            attachOffset: attachOffsetFor(nextLayout, chart.layout),
          });
          return;
        }
      }
      onUpdate(item.id, { layout: nextLayout });
      return;
    }
    const snap = magneticSnapForNote(nextLayout, chartOptions);
    if (snap) {
      onUpdate(item.id, {
        layout: snap.layout,
        attachedToId: snap.attachedToId,
        attachOffset: snap.attachOffset,
      });
      return;
    }
    onUpdate(item.id, { layout: nextLayout, attachedToId: null, attachOffset: null });
  };

  const handleDrag = (_, data) => {
    if (pickingLinkColor) setPickingLinkColor(false);
    // Keep Rnd controlled position in sync; charts also pull attached notes along.
    onUpdate(item.id, { layout: { ...layout, x: data.x, y: data.y } });
  };

  const handleDragStop = (_, data) => {
    commitLayout({ ...layout, x: data.x, y: data.y }, { snapNote: isNote });
  };

  const handleResizeStop = (_, __, ref, ___, position) => {
    commitLayout({
      x: position.x,
      y: position.y,
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    }, { snapNote: false });
  };

  const attachLabel = attachedChart ? `For: ${attachedChart.title}` : '';
  const noteExport = noteTheme.export;

  return (
    <Rnd
      bounds="parent"
      minWidth={260}
      minHeight={isNote ? 170 : 280}
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      dragHandleClassName="workspace-drag-handle"
      className={selected ? 'z-20' : 'z-10'}
    >
      <article
        ref={(node) => registerRef(item.id, node)}
        data-export-white={isNote ? undefined : 'true'}
        data-export-note={isNote ? 'true' : undefined}
        data-export-note-bg={isNote ? noteExport.body : undefined}
        data-export-note-header={isNote ? noteExport.header : undefined}
        data-export-note-border={isNote ? noteExport.border : undefined}
        data-export-note-text={isNote ? noteExport.text : undefined}
        className={`flex h-full flex-col overflow-hidden rounded-xl border shadow-lg ${
          isNote ? noteTheme.body : 'bg-white'
        } ${
          selected ? 'border-blue-500 ring-2 ring-blue-200' : isNote ? noteTheme.border : 'border-slate-200'
        }`}
        style={isNote ? {
          backgroundColor: noteExport.body,
          borderColor: noteExport.border,
          color: noteExport.text,
        } : undefined}
      >
        <header
          data-export-white={isNote ? undefined : 'true'}
          data-export-note-header={isNote ? 'true' : undefined}
          className={`workspace-drag-handle flex shrink-0 cursor-move items-start gap-2 border-b px-3 pb-2.5 pt-3 ${
            isNote ? noteTheme.header : 'bg-slate-50'
          }`}
          style={isNote ? {
            backgroundColor: noteExport.header,
            borderColor: noteExport.border,
            color: noteExport.text,
          } : undefined}
        >
          <button
            type="button"
            data-export-hide="true"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item.id);
            }}
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}
            aria-label={selected ? 'Deselect item' : 'Select item'}
          />
          {!isNote && ownLink && (
            <div ref={linkPickerRef} className="relative mt-0.5 shrink-0" data-export-hide="true">
              <button
                type="button"
                title={`${ownLink.label} tag — click to change`}
                aria-label={`Chart color tag: ${ownLink.label}. Click to change.`}
                aria-expanded={pickingLinkColor}
                aria-haspopup="listbox"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setPickingLinkColor((open) => !open);
                }}
                className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-sm hover:ring-2 hover:ring-slate-300 hover:ring-offset-1"
                style={{ backgroundColor: ownLink.swatch }}
              />
              {pickingLinkColor && (
                <div
                  role="listbox"
                  aria-label="Chart tag color"
                  className="absolute left-0 top-6 z-30 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {LINK_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      role="option"
                      title={color.label}
                      aria-label={color.label}
                      aria-selected={(item.linkColor || 'sky') === color.id}
                      onClick={() => {
                        onUpdate(item.id, { linkColor: color.id });
                        setPickingLinkColor(false);
                      }}
                      className={`h-5 w-5 rounded-full border border-black/15 ${
                        (item.linkColor || 'sky') === color.id
                          ? 'ring-2 ring-offset-1 ring-slate-500'
                          : 'hover:ring-2 hover:ring-offset-1 hover:ring-slate-300'
                      }`}
                      style={{ backgroundColor: color.swatch }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1 overflow-visible">
            <h3
              className={`break-words text-sm font-bold leading-5 ${isNote ? noteTheme.text : 'text-gray-900'}`}
              style={isNote ? { color: noteExport.text } : undefined}
            >
              {item.title}
            </h3>
            {item.subtitle && (
              <p className="break-words text-[10px] leading-4 text-gray-500">{item.subtitle}</p>
            )}
            {isNote && attachedChart && attachedLink && (
              <p
                data-export-attach="true"
                data-export-attach-label={attachLabel}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${attachedLink.soft}`}
                title={`Attached to: ${attachedChart.title}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: attachedLink.swatch }}
                  aria-hidden="true"
                />
                <span className="truncate">{attachLabel}</span>
              </p>
            )}
            {!isNote && linkedNotesCount > 0 && (
              <p className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ownLink.soft}`}>
                <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                {linkedNotesCount} note{linkedNotesCount === 1 ? '' : 's'} attached
              </p>
            )}
          </div>
          {isNote && (
            <button
              type="button"
              data-export-hide="true"
              onClick={() => setEditing((value) => !value)}
              className="text-[10px] font-semibold text-blue-600"
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          <button
            type="button"
            data-export-hide="true"
            onClick={() => onRemove(item.id)}
            className="text-gray-400 hover:text-red-600"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isNote && (
          <div
            data-export-hide="true"
            className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 ${noteTheme.header}`}
          >
            <div className="flex items-center gap-1" role="group" aria-label="Note color">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  aria-label={`${color.label} note`}
                  aria-pressed={item.noteColor === color.id || (!item.noteColor && color.id === 'yellow')}
                  onClick={() => onUpdate(item.id, { noteColor: color.id })}
                  className={`h-4 w-4 rounded-full border shadow-sm ${
                    (item.noteColor || 'yellow') === color.id
                      ? 'ring-2 ring-offset-1 ring-slate-500'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color.swatch }}
                />
              ))}
            </div>
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold text-gray-600">
              <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <select
                value={item.attachedToId || ''}
                onChange={(event) => {
                  const attachedToId = event.target.value || null;
                  if (!attachedToId) {
                    onUpdate(item.id, { attachedToId: null, attachOffset: null });
                    return;
                  }
                  const chart = chartOptions.find((entry) => entry.id === attachedToId);
                  if (!chart) {
                    onUpdate(item.id, { attachedToId, attachOffset: null });
                    return;
                  }
                  const snap = magneticSnapForNote(layout, [chart]);
                  if (snap) {
                    onUpdate(item.id, {
                      attachedToId: snap.attachedToId,
                      layout: snap.layout,
                      attachOffset: snap.attachOffset,
                    });
                    return;
                  }
                  const parked = parkNoteBesideChart(layout, chart.layout);
                  onUpdate(item.id, {
                    attachedToId,
                    layout: parked,
                    attachOffset: attachOffsetFor(parked, chart.layout),
                  });
                }}
                className="min-w-0 flex-1 truncate rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] font-medium text-gray-700"
              >
                <option value="">Not attached — drag near a chart to snap</option>
                {chartOptions.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden p-3 pt-2">
          {isNote && editing ? (
            <textarea
              autoFocus
              value={item.content || ''}
              onChange={(event) => onUpdate(item.id, { content: event.target.value })}
              className={`h-full w-full resize-none rounded-lg border p-3 text-sm focus:border-blue-500 focus:outline-none ${noteTheme.body} ${noteTheme.border} ${noteTheme.text}`}
              placeholder="Write observations, evidence, reasoning, or a report paragraph…"
            />
          ) : (
            <ChartContent item={item} noteTheme={noteTheme} />
          )}
        </div>
      </article>
    </Rnd>
  );
}

const WorkspaceView = ({
  filters, theme, importedDataVersion, workspaceItems, onAddItem, onRemoveItem, onUpdateItem,
}) => {
  const imported = useMemo(
    () => getImportedMeasurements(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importedDataVersion]
  );
  // Soft hierarchy + fallback (same as Analysis / Heat Map). Hard school-name match was
  // emptying Build chart when My Page used a directory name and CSV used a school code.
  const scopedRows = useMemo(() => {
    const softEq = (filterVal, rowVal) => (
      isBlankHierarchyField(filterVal) || isBlankHierarchyField(rowVal) || String(filterVal) === String(rowVal)
    );
    const filtered = imported.filter((row) => {
      if (!softEq(filters.instructor, row.instructor)) return false;
      if (!softEq(filters.period, row.period)) return false;
      if (!softEq(filters.group, row.group)) return false;
      return true;
    });
    return filtered.length ? filtered : imported;
  }, [imported, filters.instructor, filters.period, filters.group]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [xColumn, setXColumn] = useState('group');
  const [yColumn, setYColumn] = useState('pm25');
  const [chartType, setChartType] = useState('auto');
  const [selectedIds, setSelectedIds] = useState([]);
  const canvasRef = useRef(null);
  const itemRefs = useRef(new Map());

  const validChartTypes = useMemo(() => {
    const xNumeric = isNumeric(xColumn);
    const yNumeric = isNumeric(yColumn);
    const values = ['auto'];
    if (xNumeric && yNumeric) values.push('scatter');
    if ((xColumn === 'date' && yNumeric) || (yColumn === 'date' && xNumeric)) values.push('line');
    if (xNumeric !== yNumeric) values.push('bar', 'box');
    if (!xNumeric && !yNumeric) values.push('bar');
    return values;
  }, [xColumn, yColumn]);

  const preview = useMemo(
    () => buildChart(scopedRows, validChartTypes.includes(chartType) ? chartType : 'auto', xColumn, yColumn, theme.primary),
    [scopedRows, chartType, validChartTypes, xColumn, yColumn, theme.primary]
  );

  const addBuiltChart = () => {
    if (!chartHasData(preview)) return;
    const title = `${columnFor(xColumn).label} vs ${columnFor(yColumn).label} (${preview.kind})`;
    onAddItem({
      id: `chart-${Date.now()}`,
      title,
      subtitle: `${axisLabel(xColumn)} · ${axisLabel(yColumn)} · ${scopedRows.length} rows`,
      ...preview,
    });
    setBuilderOpen(false);
  };

  const chartOptions = useMemo(
    () => workspaceItems.filter((entry) => entry.kind !== 'note'),
    [workspaceItems]
  );

  const notesByChartId = useMemo(() => {
    const map = new Map();
    workspaceItems.forEach((entry) => {
      if (entry.kind !== 'note' || !entry.attachedToId) return;
      map.set(entry.attachedToId, (map.get(entry.attachedToId) || 0) + 1);
    });
    return map;
  }, [workspaceItems]);

  const addNote = () => {
    const selectedChart =
      chartOptions.find((chart) => selectedIds.includes(chart.id)) || null;
    const noteLayout = { x: 40, y: 40, width: 320, height: 220 };
    const parked = selectedChart
      ? parkNoteBesideChart(noteLayout, selectedChart.layout)
      : noteLayout;
    onAddItem({
      id: `note-${Date.now()}`,
      kind: 'note',
      title: 'Report notes',
      content: 'Write your observation, evidence, and reasoning here.',
      noteColor: 'yellow',
      attachedToId: selectedChart?.id || null,
      layout: parked,
      attachOffset: selectedChart
        ? attachOffsetFor(parked, selectedChart.layout)
        : null,
    });
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  const deleteSelected = () => {
    selectedIds.forEach(onRemoveItem);
    setSelectedIds([]);
  };

  const exportSelected = async () => {
    for (const id of selectedIds) {
      const item = workspaceItems.find((candidate) => candidate.id === id);
      const element = itemRefs.current.get(id);
      if (item && element) await downloadElementAsPng(element, item.title);
    }
    setSelectedIds([]);
  };

  const exportWorkspace = async () => {
    if (!canvasRef.current || !workspaceItems.length) return;
    const pad = 28;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    workspaceItems.forEach((item) => {
      const layout = item.layout || { x: 20, y: 20, width: 370, height: 310 };
      minX = Math.min(minX, layout.x);
      minY = Math.min(minY, layout.y);
      maxX = Math.max(maxX, layout.x + layout.width);
      maxY = Math.max(maxY, layout.y + layout.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
    await downloadElementAsPng(canvasRef.current, 'airstory-complete-workspace-report', {
      crop: {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        width: Math.max(320, maxX - minX + pad * 2),
        height: Math.max(240, maxY - minY + pad * 2),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto max-w-2xl">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <LayoutGrid className="h-6 w-6" style={{ color: theme.primary }} />
            Workspace
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="What is Workspace?"
              aria-label="What is Workspace?"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Your classroom storyboard — collect charts, add sticky notes, and export a report.
            Bring visuals from Analysis (<span className="font-medium">Send to Workspace</span>),
            or build new ones here.
          </p>
        </div>
        <button type="button" onClick={() => setBuilderOpen(true)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${theme.bg} ${theme.hover}`}>
          <Plus className="h-4 w-4" /> Build chart
        </button>
        <button type="button" onClick={addNote} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <FileText className="h-4 w-4" /> Add note
        </button>
        <button type="button" disabled={!selectedIds.length} onClick={exportSelected} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">
          <CheckSquare className="h-4 w-4" /> Export selected ({selectedIds.length})
        </button>
        <button type="button" disabled={!workspaceItems.length} onClick={exportWorkspace} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">
          <Download className="h-4 w-4" /> Export workspace
        </button>
        <button type="button" disabled={!selectedIds.length} onClick={deleteSelected} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-300 bg-slate-200 shadow-inner" style={{ maxHeight: 'calc(100vh - 190px)' }}>
        <div
          ref={canvasRef}
          className="relative bg-slate-50"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {workspaceItems.length === 0 && (
            <div
              className="absolute left-1/2 top-[16%] w-[min(34rem,92%)] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/60 bg-white/75 px-7 py-6 text-left shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Workspace</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900">
                Build your air-quality story
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                A free canvas for student reports — pin charts, write sticky notes, arrange evidence, then export for slides or a lab write-up.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  ['1', 'From Analysis, tap Send to Workspace — or Build chart here.'],
                  ['2', 'Add a note, drag it near a chart to attach, and pick a link color.'],
                  ['3', 'Export selected cards or the whole board when you’re ready.'],
                ].map(([n, text]) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900/5 text-[12px] font-semibold text-slate-700">
                      {n}
                    </span>
                    <p className="pt-0.5 text-[14px] leading-snug text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[12px] leading-relaxed text-slate-500">
                Items stay for this browser session. Export before you refresh or log out.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="rounded-full bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#0066D6] active:scale-[0.98]"
                >
                  Build a chart
                </button>
                <button
                  type="button"
                  onClick={addNote}
                  className="rounded-full bg-slate-900/5 px-4 py-2 text-[13px] font-semibold text-slate-800 transition hover:bg-slate-900/10 active:scale-[0.98]"
                >
                  Add a note
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  className="rounded-full px-3 py-2 text-[13px] font-medium text-[#007AFF] transition hover:bg-[#007AFF]/10"
                >
                  More tips
                </button>
              </div>
            </div>
          )}
          {workspaceItems.map((item) => (
            <CanvasItem
              key={item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              onSelect={toggleSelected}
              onRemove={onRemoveItem}
              onUpdate={onUpdateItem}
              chartOptions={chartOptions}
              linkedNotesCount={notesByChartId.get(item.id) || 0}
              registerRef={(id, node) => {
                if (node) itemRefs.current.set(id, node);
                else itemRefs.current.delete(id);
              }}
            />
          ))}
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-[420px] overflow-hidden rounded-[24px] border border-white/50 bg-white/80 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pb-2 pt-5">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-slate-600 transition hover:bg-black/[0.1]"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#5AC8FA] to-[#007AFF] shadow-sm">
                <LayoutGrid className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <h3 className="text-center text-[20px] font-semibold tracking-tight text-slate-900">
                What is Workspace?
              </h3>
              <p className="mt-1.5 text-center text-[13px] leading-relaxed text-slate-500">
                Your report board for arranging charts and notes — separate from class membership in the sidebar.
              </p>
            </div>

            <div className="mx-4 mb-4 overflow-hidden rounded-[16px] bg-white/70 ring-1 ring-black/[0.04]">
              {[
                { title: 'Charts', body: 'From Analysis (Send to Workspace) or Build chart on this page.' },
                { title: 'Notes', body: 'Sticky cards for observations and reasoning. Drop near a chart to attach — they follow when you move it.' },
                { title: 'Link colors', body: 'The circle on a chart lets you say “see the blue chart” in your write-up.' },
                { title: 'Export', body: 'Save PNGs of selected cards or the whole board for slides or Docs.' },
                { title: 'Session-only', body: 'Clears on refresh or logout for now — export before you leave.' },
              ].map((row, i, arr) => (
                <div
                  key={row.title}
                  className={`flex gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-black/[0.06]' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900">{row.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{row.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pb-5">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="w-full rounded-full bg-[#007AFF] py-[11px] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#0066D6] active:scale-[0.99]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBuilderOpen(false)}>
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Build a chart</h2>
                <p className="text-sm text-gray-500">Choose columns and one of the valid classroom visualizations.</p>
              </div>
              <button type="button" onClick={() => setBuilderOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              {[
                ['X axis', xColumn, setXColumn],
                ['Y axis', yColumn, setYColumn],
              ].map(([label, value, setter]) => (
                <label key={label} className="text-xs font-semibold text-gray-600">
                  {label}
                  <select value={value} onChange={(event) => setter(event.target.value)} className="mt-1 block min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                    <optgroup label="Numeric">{NUMERIC_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</optgroup>
                    <optgroup label="Categorical">{CATEGORICAL_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</optgroup>
                  </select>
                </label>
              ))}
              <label className="text-xs font-semibold text-gray-600">
                Visualization
                <select value={validChartTypes.includes(chartType) ? chartType : 'auto'} onChange={(event) => setChartType(event.target.value)} className="mt-1 block min-w-[170px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  {validChartTypes.map((kind) => <option key={kind} value={kind}>{kind === 'auto' ? 'Auto suggested' : kind[0].toUpperCase() + kind.slice(1)}</option>)}
                </select>
              </label>
              <span className="flex items-center gap-1 pb-2 text-xs text-gray-500">
                <Sparkles className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                {resolveChartKind('auto', xColumn, yColumn)} suggested
              </span>
              <button
                type="button"
                onClick={addBuiltChart}
                disabled={!chartHasData(preview)}
                className={`ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${theme.bg} ${theme.hover}`}
              >
                Add to canvas
              </button>
            </div>
            {!imported.length && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Raw Data is empty — import or sync measurements before building a chart.
              </p>
            )}
            {imported.length > 0 && (
              <p className="mb-3 text-xs text-gray-500">
                Using {scopedRows.length} row{scopedRows.length === 1 ? '' : 's'} from your loaded measurements
                {scopedRows.length !== imported.length ? ` (${imported.length} total in cache)` : ''}.
              </p>
            )}
            <div className="rounded-xl border bg-white p-3">
              <div className="mb-2 text-sm font-bold text-gray-800">
                {columnFor(xColumn).label} vs {columnFor(yColumn).label} ({preview.kind})
              </div>
              <div className="h-[280px]">
                <ChartContent item={preview} plotHeight={220} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceView;
