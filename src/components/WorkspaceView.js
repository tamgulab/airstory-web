import React, { useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  BarChart, Bar, CartesianGrid, Legend, Line, LineChart, Scatter, ScatterChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import {
  CheckSquare, Download, FileText, LayoutGrid, Plus, Sparkles, Trash2, X,
} from 'lucide-react';
import { getImportedMeasurements, isBlankHierarchyField } from '../utils/importedData';
import { downloadElementAsPng } from './charts/SaveChartButton';
import BoxPlot from './charts/BoxPlot';

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1050;
const AXIS_PROPS = {
  stroke: '#94A3B8',
  style: { fontSize: '11px' },
  tickLine: true,
  axisLine: { stroke: '#94A3B8' },
};

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

function resolveChartKind(requested, xKey, yKey) {
  if (requested !== 'auto') return requested;
  if (isNumeric(xKey) && isNumeric(yKey)) return 'scatter';
  if (xKey === 'date' && isNumeric(yKey)) return 'line';
  if (!isNumeric(xKey) && isNumeric(yKey)) return 'box';
  return 'bar';
}

function buildChart(rows, requestedKind, xKey, yKey, color) {
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

function ChartContent({ item }) {
  if (item.kind === 'note') {
    return (
      <div className="h-full whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-gray-700">
        {item.content || 'Double-click Edit to write your report notes.'}
      </div>
    );
  }
  if (item.kind === 'box') {
    return <BoxPlot groups={item.groups || []} unit={item.unit || ''} color={item.color} height={230} />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      {item.kind === 'scatter' ? (
        <ScatterChart margin={{ top: 8, right: 12, bottom: 22, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis type="number" dataKey="x" name={item.xLabel} label={{ value: item.xLabel, position: 'insideBottom', offset: -12 }} {...AXIS_PROPS} />
          <YAxis type="number" dataKey="y" name={item.yLabel} label={{ value: item.yLabel, angle: -90, position: 'insideLeft' }} {...AXIS_PROPS} />
          <ZAxis range={[55, 55]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={item.data || []} fill={item.color || '#0EA5E9'} fillOpacity={0.75} />
        </ScatterChart>
      ) : item.kind === 'bar' ? (
        <BarChart data={item.data || []} margin={{ top: 8, right: 12, bottom: 22, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={item.xKey || 'category'} label={{ value: item.xLabel, position: 'insideBottom', offset: -12 }} {...AXIS_PROPS} />
          <YAxis label={{ value: item.yLabel, angle: -90, position: 'insideLeft' }} {...AXIS_PROPS} />
          <Tooltip />
          <Bar dataKey="value" fill={item.color || '#0EA5E9'} radius={[5, 5, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={item.data || []} margin={{ top: 8, right: 12, bottom: 22, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={item.xKey || 'date'} label={{ value: item.xLabel, position: 'insideBottom', offset: -12 }} {...AXIS_PROPS} />
          <YAxis label={{ value: item.yLabel, angle: -90, position: 'insideLeft' }} {...AXIS_PROPS} />
          <Tooltip />
          {(item.series || [{ dataKey: 'value', label: 'Value', color: item.color || '#0EA5E9' }]).map((series) => (
            <Line key={series.dataKey} type="monotone" dataKey={series.dataKey} name={series.label} stroke={series.color} strokeWidth={2.5} dot={{ r: 2.5 }} />
          ))}
          {(item.series?.length || 0) > 1 && <Legend />}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function CanvasItem({
  item, selected, onSelect, onRemove, onUpdate, registerRef,
}) {
  const [editing, setEditing] = useState(false);
  const layout = item.layout || { x: 20, y: 20, width: 370, height: 310 };
  return (
    <Rnd
      bounds="parent"
      minWidth={260}
      minHeight={item.kind === 'note' ? 150 : 230}
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      onDragStop={(_, data) => onUpdate(item.id, { layout: { ...layout, x: data.x, y: data.y } })}
      onResizeStop={(_, __, ref, ___, position) => onUpdate(item.id, {
        layout: {
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        },
      })}
      dragHandleClassName="workspace-drag-handle"
      className={selected ? 'z-20' : 'z-10'}
    >
      <article
        ref={(node) => registerRef(item.id, node)}
        className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-lg ${
          selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
        }`}
      >
        <header className="workspace-drag-handle flex cursor-move items-start gap-2 border-b bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item.id);
            }}
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}
            aria-label={selected ? 'Deselect item' : 'Select item'}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900">{item.title}</h3>
            {item.subtitle && <p className="truncate text-[10px] text-gray-500">{item.subtitle}</p>}
          </div>
          {item.kind === 'note' && (
            <button type="button" onClick={() => setEditing((value) => !value)} className="text-[10px] font-semibold text-blue-600">
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          <button type="button" onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-600" aria-label="Remove item">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 p-3">
          {item.kind === 'note' && editing ? (
            <textarea
              autoFocus
              value={item.content || ''}
              onChange={(event) => onUpdate(item.id, { content: event.target.value })}
              className="h-full w-full resize-none rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Write observations, evidence, reasoning, or a report paragraph…"
            />
          ) : (
            <ChartContent item={item} />
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
  const scopedRows = useMemo(
    () => imported.filter((row) => !filters.school || isBlankHierarchyField(row.school) || row.school === filters.school),
    [imported, filters.school]
  );
  const [builderOpen, setBuilderOpen] = useState(false);
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
    const title = `${columnFor(xColumn).label} vs ${columnFor(yColumn).label} (${preview.kind})`;
    onAddItem({
      id: `chart-${Date.now()}`,
      title,
      subtitle: `${axisLabel(xColumn)} · ${axisLabel(yColumn)} · current filters`,
      ...preview,
    });
    setBuilderOpen(false);
  };

  const addNote = () => {
    onAddItem({
      id: `note-${Date.now()}`,
      kind: 'note',
      title: 'Report notes',
      content: 'Write your observation, evidence, and reasoning here.',
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <LayoutGrid className="h-6 w-6" style={{ color: theme.primary }} />
            Workspace
          </h1>
          <p className="text-sm text-gray-500">Drag, resize, annotate, and arrange a report on the canvas.</p>
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
        <button type="button" onClick={() => downloadElementAsPng(canvasRef.current, 'airstory-complete-workspace-report')} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700">
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
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-dashed border-slate-300 bg-white/80 px-8 py-6 text-center text-sm text-gray-500">
              Build a chart, add a note, or send a chart here from Analysis.
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
              registerRef={(id, node) => {
                if (node) itemRefs.current.set(id, node);
                else itemRefs.current.delete(id);
              }}
            />
          ))}
        </div>
      </div>

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
              <button type="button" onClick={addBuiltChart} className={`ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white ${theme.bg} ${theme.hover}`}>
                Add to canvas
              </button>
            </div>
            <div className="h-[360px] rounded-xl border bg-white p-3">
              <div className="mb-2 text-sm font-bold text-gray-800">
                {columnFor(xColumn).label} vs {columnFor(yColumn).label} ({preview.kind})
              </div>
              <div className="h-[310px]"><ChartContent item={preview} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceView;
