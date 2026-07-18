import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, ScatterChart, Scatter, CartesianGrid, ZAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  GitCompareArrows,
  GraduationCap,
  Info,
  Lightbulb,
  MapPin,
  Pin,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { getImportedMeasurements, isBlankHierarchyField } from '../utils/importedData';
import { groupsForPeriodFromStructure, periodsFromClassStructure } from '../utils/classStructure';
import { REFERENCE_LOCATIONS, getReferenceWeekSeries } from '../utils/referenceTrends';
import { apiRequest } from '../api/http';
import { getColorForValue, getStatusLabel, hasHealthThreshold } from '../utils/airQuality';
import { detectOutliers } from '../utils/outliers';
import SaveChartButton from './charts/SaveChartButton';
import BoxPlot from './charts/BoxPlot';
import ReflectionPrompt from './charts/ReflectionPrompt';

/** Shared "good defaults" axis styling: visible axis line + tick line, per the chart-defaults checklist item. */
const AXIS_STYLE = { fontSize: '12px' };
const AXIS_LINE_PROPS = { stroke: '#9CA3AF', style: AXIS_STYLE, tickLine: true, axisLine: { stroke: '#9CA3AF' } };

/** Pins a snapshot of a chart's config/data into the new Workspace tab (Phase 3). */
const SendToWorkspaceButton = ({ onSendToWorkspace, buildItem, className = '' }) => {
  if (!onSendToWorkspace) return null;
  return (
    <button
      type="button"
      onClick={() => onSendToWorkspace(buildItem())}
      title="Pin this chart to your Workspace tab"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-lg transition-all shadow-sm bg-slate-700 hover:bg-slate-800 ${className}`}
    >
      <Pin className="h-3.5 w-3.5" />
      Send to Workspace
    </button>
  );
};

/** Metrics we try to load from OpenAQ near the reference pin (when a sensor exists). */
const OPENAQ_REFERENCE_METRICS = ['pm25', 'co', 'temp', 'humidity'];

const COMPARISON_PALETTE = ['#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6'];
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Average `metricKey` per weekday across all matching rows (rows may span several weeks). */
function weekdayAverageSeries(rows, metricKey) {
  const byDay = {};
  rows.forEach((row) => {
    const d = new Date(`${row.date}T${row.time || '00:00'}`);
    if (Number.isNaN(d.getTime())) return;
    const label = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
    const value = Number(row[metricKey]);
    if (!Number.isFinite(value)) return;
    if (!byDay[label]) byDay[label] = { sum: 0, count: 0 };
    byDay[label].sum += value;
    byDay[label].count += 1;
  });
  return WEEKDAY_LABELS.map((label) => ({
    day: label,
    value: byDay[label] ? Number((byDay[label].sum / byDay[label].count).toFixed(2)) : null,
  }));
}

const ComparisonModal = ({
  isOpen,
  onClose,
  selectedMetric,
  theme,
  metricThemes,
  currentFilters,
  workspaceGroups,
  comparisonSchoolCodes,
  importedRows,
}) => {
  const schoolChipList =
    comparisonSchoolCodes?.length > 0
      ? comparisonSchoolCodes
      : [...new Set([currentFilters?.school].filter(Boolean))];
  const groupButtonList =
    workspaceGroups?.length > 0
      ? workspaceGroups
      : ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
  const [comparisonType, setComparisonType] = useState('location'); // 'group', 'school', 'location', 'time'
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState(() =>
    REFERENCE_LOCATIONS.slice(0, 3).map((l) => l.name)
  );
  const [timeRange, setTimeRange] = useState('week');
  const comparisonChartRef = useRef(null);

  if (!isOpen) return null;

  const getComparisonData = () => {
    switch (comparisonType) {
      case 'location': {
        if (!selectedLocations.length) return [];
        return selectedLocations.map((loc, idx) => {
          const series = getReferenceWeekSeries(loc, selectedMetric);
          const values = series.map((s) => s.value);
          const rawAvg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const avg =
            selectedMetric === 'co'
              ? Math.round(rawAvg * 100) / 100
              : Math.round(rawAvg);
          return {
            name: loc,
            values,
            avg,
            color: COMPARISON_PALETTE[idx % COMPARISON_PALETTE.length],
          };
        });
      }
      // Uses only rows already loaded in this session/browser (imported CSV + your workspace's
      // synced measurements) — not a live cross-tenant backend query. Crowdsourced comparison
      // across other schools' private data needs a team-level visibility decision first.
      case 'group': {
        const rows = importedRows || [];
        const groupsToShow = selectedGroups.length ? selectedGroups : groupButtonList.slice(0, 3);
        if (!groupsToShow.length) return [];
        return groupsToShow.map((g, idx) => {
          const groupRows = rows.filter((r) => r.group === g);
          const series = weekdayAverageSeries(groupRows, selectedMetric);
          const values = series.map((s) => s.value ?? 0);
          const present = series.map((s) => s.value).filter((v) => v != null);
          const avg = present.length ? Number((present.reduce((a, b) => a + b, 0) / present.length).toFixed(2)) : 0;
          return { name: `Group ${String(g).replace('G', '')}`, values, avg, color: COMPARISON_PALETTE[idx % COMPARISON_PALETTE.length] };
        });
      }
      case 'school': {
        const rows = importedRows || [];
        const schoolsToShow = selectedSchools.length ? selectedSchools : schoolChipList.slice(0, 3);
        if (!schoolsToShow.length) return [];
        return schoolsToShow.map((s, idx) => {
          const schoolRows = rows.filter((r) => r.school === s);
          const series = weekdayAverageSeries(schoolRows, selectedMetric);
          const values = series.map((d) => d.value ?? 0);
          const present = series.map((d) => d.value).filter((v) => v != null);
          const avg = present.length ? Number((present.reduce((a, b) => a + b, 0) / present.length).toFixed(2)) : 0;
          return { name: s, values, avg, color: COMPARISON_PALETTE[idx % COMPARISON_PALETTE.length] };
        });
      }
      case 'time':
        return [];
      default:
        return [];
    }
  };

  const comparisonData = getComparisonData();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Create chart data
  const chartData = days.map((day, idx) => {
    const dataPoint = { day };
    comparisonData.forEach(item => {
      dataPoint[item.name] = item.values[idx];
    });
    return dataPoint;
  });

  const toggleGroupSelection = (group) => {
    setSelectedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const toggleSchoolSelection = (school) => {
    setSelectedSchools(prev => 
      prev.includes(school) 
        ? prev.filter(s => s !== school)
        : [...prev, school]
    );
  };

  const toggleLocationSelection = (location) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-6xl w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`${theme.bg} text-white p-6 rounded-t-2xl flex items-center justify-between sticky top-0 z-10`}>
          <div>
            <h3 className="text-xl font-bold">Compare Data - {metricThemes[selectedMetric].label}</h3>
            <p className="text-sm opacity-90 mt-1">Compare across groups, schools, locations, and time periods</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Comparison Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Comparison Type</label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'group', label: 'By Group', Icon: Users },
                { id: 'school', label: 'By School', Icon: GraduationCap },
                { id: 'location', label: 'By Location', Icon: MapPin },
                { id: 'time', label: 'By Time', Icon: Calendar }
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setComparisonType(type.id)}
                  className={`p-4 rounded-xl text-sm font-medium transition-all ${
                    comparisonType === type.id
                      ? `${theme.bg} text-white shadow-lg`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <type.Icon className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
                  <div>{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selection Panel */}
          <div className="mb-6 bg-gray-50 rounded-xl p-4">
            {comparisonType === 'group' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Groups to Compare</h4>
                <div className="flex flex-wrap gap-2">
                  {groupButtonList.map((group) => (
                    <button
                      key={group}
                      onClick={() => toggleGroupSelection(group)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedGroups.includes(group)
                          ? `${theme.bg} text-white`
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Group {group.replace('G', '')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Currently viewing: {currentFilters.school} - Your group is G{currentFilters.group.replace('G', '')}</p>
              </div>
            )}

            {comparisonType === 'school' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Schools to Compare</h4>
                <div className="flex flex-wrap gap-2">
                  {schoolChipList.map((school) => (
                    <button
                      key={school}
                      onClick={() => toggleSchoolSelection(school)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedSchools.includes(school)
                          ? `${theme.bg} text-white`
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {school}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Your school: {currentFilters.school}</p>
              </div>
            )}

            {comparisonType === 'location' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Locations to Compare</h4>
                <div className="flex flex-wrap gap-2">
                  {REFERENCE_LOCATIONS.map((ref) => (
                    <button
                      key={ref.name}
                      onClick={() => toggleLocationSelection(ref.name)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedLocations.includes(ref.name)
                          ? `${theme.bg} text-white`
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {ref.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Curves use the same Philadelphia, New York, and Hanoi city references as Analysis.
                </p>
              </div>
            )}

            {comparisonType === 'time' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Time Period</h4>
                <div className="flex gap-2">
                  {['week', 'month', 'year'].map(period => (
                    <button
                      key={period}
                      onClick={() => setTimeRange(period)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        timeRange === period
                          ? `${theme.bg} text-white`
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(comparisonType === 'group' || comparisonType === 'school') && (
            <p className="mb-4 text-sm text-gray-600 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              Weekday averages from measurements already loaded in this session (your imported CSV / synced
              workspace data) — not a live query of other schools' private data. Cross-school crowdsourced
              comparisons need a shared-visibility decision from the team first.
            </p>
          )}
          {comparisonType === 'time' && (
            <p className="mb-4 text-sm text-gray-600 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
              Time-period comparisons are not wired to real data yet. Use <strong>By Location</strong>,{' '}
              <strong>By Group</strong>, or <strong>By School</strong> instead.
            </p>
          )}

          {/* Comparison Chart */}
          <div ref={comparisonChartRef} className="bg-white rounded-xl p-6 border-2 border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Comparison Visualization</h4>
              {comparisonData.length > 0 && (
                <SaveChartButton
                  targetRef={comparisonChartRef}
                  filename={`${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}-comparison-by-${comparisonType}`}
                />
              )}
            </div>
            {comparisonData.length === 0 ? (
              <div className="flex h-[400px] items-center justify-center text-center text-sm text-gray-500 px-6">
                {comparisonType === 'location'
                  ? 'Select at least one city above to plot reference trends.'
                  : comparisonType === 'time'
                    ? 'No chart for this comparison type until workspace data is wired in.'
                    : 'Select at least one group/school above, or add more imported data, to plot a comparison.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="day"
                    label={{ value: 'Day', position: 'insideBottom', offset: -2, style: { fill: '#6B7280', fontSize: '11px' } }}
                    {...AXIS_LINE_PROPS}
                  />
                  <YAxis
                    label={{
                      value: metricThemes[selectedMetric].unit,
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' },
                    }}
                    {...AXIS_LINE_PROPS}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      padding: '12px',
                    }}
                  />
                  <Legend />
                  {comparisonData.map((item, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={item.name}
                      stroke={item.color}
                      strokeWidth={2}
                      dot={{ fill: item.color, r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Comparison Statistics Table */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <h4 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">Statistical Comparison</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Average</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Min</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Max</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Range</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparisonData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No comparison rows. Choose locations (reference series) or another view with real data.
                      </td>
                    </tr>
                  ) : (
                    comparisonData.map((item, idx) => {
                      const min = Math.min(...item.values);
                      const max = Math.max(...item.values);
                      const trend =
                        item.values[item.values.length - 1] > item.values[0] ? 'increasing' : 'decreasing';

                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="font-medium text-gray-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-semibold">{item.avg}</td>
                          <td className="px-4 py-3 text-green-600 font-semibold">{min}</td>
                          <td className="px-4 py-3 text-orange-600 font-semibold">{max}</td>
                          <td className="px-4 py-3 text-gray-700">{max - min}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {trend === 'increasing' ? (
                                <>
                                  <TrendingUp className="w-4 h-4 text-orange-600" />
                                  <span className="text-sm text-orange-600 font-medium">Rising</span>
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-600 font-medium">Falling</span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Insights */}
          {comparisonData.length > 0 && (
            <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="mb-2 flex items-center gap-2 font-semibold text-blue-900">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                Key Insights
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • Highest average:{' '}
                  <strong>
                    {comparisonData.reduce((max, item) => (item.avg > max.avg ? item : max), comparisonData[0]).name}
                  </strong>{' '}
                  (
                  {comparisonData.reduce((max, item) => (item.avg > max.avg ? item : max), comparisonData[0]).avg}{' '}
                  {metricThemes[selectedMetric].unit})
                </li>
                <li>
                  • Lowest average:{' '}
                  <strong>
                    {comparisonData.reduce((min, item) => (item.avg < min.avg ? item : min), comparisonData[0]).name}
                  </strong>{' '}
                  (
                  {comparisonData.reduce((min, item) => (item.avg < min.avg ? item : min), comparisonData[0]).avg}{' '}
                  {metricThemes[selectedMetric].unit})
                </li>
                <li>
                  • Range across series:{' '}
                  {Math.max(...comparisonData.map((d) => d.avg)) - Math.min(...comparisonData.map((d) => d.avg))}{' '}
                  {metricThemes[selectedMetric].unit}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AnalysisView = ({
  selectedMetric,
  setSelectedMetric,
  filters,
  theme,
  metricThemes,
  importedDataVersion,
  classStructure,
  onSendToWorkspace,
}) => {
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showReferenceInfo, setShowReferenceInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'compare'
  const [compareMode, setCompareMode] = useState('openaq'); // openaq | group | class | school
  const [compareGroup, setCompareGroup] = useState('');
  const [referenceLocation, setReferenceLocation] = useState(REFERENCE_LOCATIONS[0]?.name || 'Philadelphia');
  const [openaqPoints, setOpenaqPoints] = useState(null);
  const [openaqMeta, setOpenaqMeta] = useState({ status: 'idle', message: '' });
  const [openSections, setOpenSections] = useState({
    recent: true,
    trends: true,
    distribution: false,
    box: false,
    scatter: false,
    insights: false,
  });
  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const imported = useMemo(
    () => getImportedMeasurements(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importedDataVersion]
  );
  const scopedData = useMemo(() => {
    const pool = imported.length ? imported : [];
    return pool.filter((row) => {
      if (filters.school && row.school && row.school !== filters.school) return false;
      if (filters.instructor && row.instructor && row.instructor !== filters.instructor) return false;
      if (filters.period && row.period && row.period !== filters.period) return false;
      if (filters.group && row.group && row.group !== filters.group) return false;
      return true;
    });
  }, [imported, filters]);

  const hasData = scopedData.length > 0;

  const classScopeData = useMemo(() => {
    return imported.filter((row) => {
      if (filters.school && !isBlankHierarchyField(row.school) && row.school !== filters.school)
        return false;
      if (
        filters.instructor &&
        !isBlankHierarchyField(row.instructor) &&
        row.instructor !== filters.instructor
      )
        return false;
      if (filters.period && !isBlankHierarchyField(row.period) && row.period !== filters.period)
        return false;
      return true;
    });
  }, [imported, filters.school, filters.instructor, filters.period]);

  const schoolScopeData = useMemo(() => {
    return imported.filter((row) => {
      if (filters.school && !isBlankHierarchyField(row.school) && row.school !== filters.school)
        return false;
      return true;
    });
  }, [imported, filters.school]);

  const monthData = useMemo(() => {
    if (!scopedData.length) return [];
    const byDate = {};
    scopedData.forEach((row) => {
      const key = row.date;
      const value = Number(row[selectedMetric] ?? 0);
      if (!byDate[key]) byDate[key] = { sum: 0, count: 0 };
      byDate[key].sum += value;
      byDate[key].count += 1;
    });
    return Object.entries(byDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, agg]) => ({ date, value: Number((agg.sum / agg.count).toFixed(2)) }));
  }, [scopedData, selectedMetric]);

  const weekData = useMemo(() => {
    if (!monthData.length) return [];
    return monthData.slice(-7).map((d) => ({
      day: new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.value,
      date: d.date,
    }));
  }, [monthData]);

  const openaqByDate = useMemo(() => {
    if (!openaqPoints?.length) return null;
    return Object.fromEntries(openaqPoints.map((p) => [p.date, p.value]));
  }, [openaqPoints]);

  useEffect(() => {
    if (!weekData.length || !OPENAQ_REFERENCE_METRICS.includes(selectedMetric)) {
      setOpenaqPoints(null);
      setOpenaqMeta({ status: 'idle', message: '' });
      return;
    }
    const loc = REFERENCE_LOCATIONS.find((l) => l.name === referenceLocation);
    if (loc?.lat == null || loc?.lng == null) return;

    let cancelled = false;
    (async () => {
      setOpenaqMeta({ status: 'loading', message: '' });
      try {
        const dateFrom = weekData[0].date;
        const dateTo = weekData[weekData.length - 1].date;
        const q = new URLSearchParams({
          lat: String(loc.lat),
          lng: String(loc.lng),
          date_from: dateFrom,
          date_to: dateTo,
          metric: selectedMetric,
        });
        const data = await apiRequest(`/analytics/openaq/daily?${q.toString()}`);
        if (cancelled) return;
        if (data.error === 'no_sensor') {
          setOpenaqPoints(null);
          setOpenaqMeta({
            status: 'error',
            message: data.message || 'No OpenAQ sensor for this metric near the selected pin — using simulated reference.',
          });
          return;
        }
        setOpenaqPoints(data.points || []);
        const label = data.locationName ? `OpenAQ @ ${data.locationName}` : 'OpenAQ';
        setOpenaqMeta({ status: 'ok', message: label });
      } catch (e) {
        if (cancelled) return;
        setOpenaqPoints(null);
        setOpenaqMeta({
          status: 'error',
          message: e?.message || 'OpenAQ unavailable — using simulated reference.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekData, referenceLocation, selectedMetric]);

  /** Your week vs OpenAQ when a nearby sensor exists for this metric, else simulated reference. */
  const weekCompareData = useMemo(() => {
    if (!weekData.length) return [];
    const sim = getReferenceWeekSeries(referenceLocation, selectedMetric);
    return weekData.map((row, i) => {
      let reference;
      if (
        OPENAQ_REFERENCE_METRICS.includes(selectedMetric) &&
        openaqByDate &&
        openaqByDate[row.date] != null
      ) {
        reference = openaqByDate[row.date];
      } else {
        reference = sim[i]?.value ?? sim[sim.length - 1]?.value;
      }
      return {
        label: row.day,
        yours: row.value,
        reference,
      };
    });
  }, [weekData, referenceLocation, selectedMetric, openaqByDate]);

  const stats = useMemo(() => {
    const allValues = monthData.map((d) => Number(d.value));
    if (!allValues.length) return null;
    const avgValue = Math.round(allValues.reduce((sum, val) => sum + val, 0) / allValues.length);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const sortedValues = [...allValues].sort((a, b) => a - b);
    const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];
    const standardDeviation = Math.sqrt(
      allValues.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / allValues.length
    ).toFixed(2);
    return { avgValue, minValue, maxValue, medianValue, standardDeviation, allValues };
  }, [monthData]);

  const classAverage = useMemo(() => {
    const schoolRows = classScopeData;
    if (!schoolRows.length) return null;
    return Math.round(
      schoolRows.reduce((sum, row) => sum + Number(row[selectedMetric] || 0), 0) / schoolRows.length
    );
  }, [classScopeData, selectedMetric]);

  const schoolAverage = useMemo(() => {
    const schoolRows = schoolScopeData;
    if (!schoolRows.length) return null;
    return Math.round(
      schoolRows.reduce((sum, row) => sum + Number(row[selectedMetric] || 0), 0) / schoolRows.length
    );
  }, [schoolScopeData, selectedMetric]);

  const availableCompareGroups = useMemo(() => {
    const fromData = [...new Set(classScopeData.map((r) => r.group).filter(Boolean))];
    const period = filters.period || periodsFromClassStructure(classStructure)[0];
    const fromWorkspace = groupsForPeriodFromStructure(classStructure, period);
    const merged = [...new Set([...fromWorkspace, ...fromData])].sort();
    return merged.filter((g) => g !== filters.group);
  }, [classScopeData, filters.group, filters.period, classStructure]);

  const workspaceGroupsForCompare = useMemo(() => {
    const p = filters.period || periodsFromClassStructure(classStructure)[0];
    const g = groupsForPeriodFromStructure(classStructure, p);
    if (g.length) return g;
    return ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
  }, [classStructure, filters.period]);

  const comparisonSchoolCodes = useMemo(() => {
    const fromFile = [...new Set(imported.map((r) => r.school).filter(Boolean))];
    const merged = [...new Set([filters.school, ...fromFile])].filter(Boolean);
    return merged.sort();
  }, [imported, filters.school]);

  useEffect(() => {
    if (!availableCompareGroups.length) {
      setCompareGroup('');
      return;
    }
    if (!compareGroup || !availableCompareGroups.includes(compareGroup)) {
      setCompareGroup(availableCompareGroups[0]);
    }
  }, [availableCompareGroups, compareGroup]);

  const compareChartData = useMemo(() => {
    if (!weekData.length) return [];
    const makeDailySeries = (rows) => {
      const byDate = {};
      rows.forEach((row) => {
        const key = row.date;
        const value = Number(row[selectedMetric] ?? 0);
        if (!byDate[key]) byDate[key] = { sum: 0, count: 0 };
        byDate[key].sum += value;
        byDate[key].count += 1;
      });
      return Object.entries(byDate)
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .map(([date, agg]) => ({ date, value: Number((agg.sum / agg.count).toFixed(2)) }));
    };

    if (compareMode === 'openaq') {
      return weekCompareData.map((d) => ({ day: d.label, yours: d.yours, comparison: d.reference }));
    }

    const dayKeys = weekData.map((d) => d.date);
    let comparisonSeries = [];
    if (compareMode === 'group' && compareGroup) {
      comparisonSeries = makeDailySeries(classScopeData.filter((r) => r.group === compareGroup));
    } else if (compareMode === 'class') {
      comparisonSeries = makeDailySeries(classScopeData);
    } else if (compareMode === 'school') {
      comparisonSeries = makeDailySeries(schoolScopeData);
    }
    const comparisonByDate = Object.fromEntries(comparisonSeries.map((d) => [d.date, d.value]));

    return weekData
      .filter((d) => dayKeys.includes(d.date))
      .map((d) => ({
        day: d.day,
        yours: d.value,
        comparison: comparisonByDate[d.date] ?? null,
      }));
  }, [weekData, weekCompareData, compareMode, compareGroup, classScopeData, schoolScopeData, selectedMetric]);

  const avgValue = stats?.avgValue ?? 0;
  const minValue = stats?.minValue ?? 0;
  const maxValue = stats?.maxValue ?? 0;
  const medianValue = stats?.medianValue ?? 0;
  const allValues = stats?.allValues ?? [];

  // Outlier / surprising-reading spotting (IQR-based) — a callout list, not a stats test.
  const dailyOutliers = useMemo(
    () => detectOutliers(monthData, (d) => d.value),
    [monthData]
  );

  // Box plot groups: distribution of the selected metric per team in the current class period.
  const boxPlotGroups = useMemo(() => {
    const byGroup = {};
    classScopeData.forEach((row) => {
      const key = row.group || 'Ungrouped';
      const value = Number(row[selectedMetric]);
      if (!Number.isFinite(value)) return;
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(value);
    });
    return Object.entries(byGroup)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, values]) => ({ label, values }));
  }, [classScopeData, selectedMetric]);

  // Bivariate / scatter — pick a second metric to plot against the selected one.
  const [scatterMetric, setScatterMetric] = useState(
    () => Object.keys(metricThemes).find((k) => k !== selectedMetric) || selectedMetric
  );
  useEffect(() => {
    if (scatterMetric === selectedMetric) {
      const alt = Object.keys(metricThemes).find((k) => k !== selectedMetric);
      if (alt) setScatterMetric(alt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMetric]);
  const scatterData = useMemo(
    () =>
      scopedData
        .map((row) => ({
          x: Number(row[selectedMetric]),
          y: Number(row[scatterMetric]),
          group: row.group || 'Ungrouped',
        }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [scopedData, selectedMetric, scatterMetric]
  );

  // Refs for per-chart "Save image" buttons (2c) and the sticky context header (2a).
  const weekChartRef = useRef(null);
  const monthChartRef = useRef(null);
  const distributionChartRef = useRef(null);
  const boxPlotRef = useRef(null);
  const scatterChartRef = useRef(null);
  const quickCompareChartRef = useRef(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analysis Dashboard</h1>
        <p className="text-gray-600">Statistical analysis and trends</p>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-lg border border-gray-200 inline-flex">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'overview'
              ? `${theme.bg} text-white shadow-md`
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'compare'
              ? `${theme.bg} text-white shadow-md`
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
          Compare Data
        </button>
      </div>

      {/* Compact sticky context + section rail. It replaces the large metric card and keeps
          navigation available without adding another page-level tab row. */}
      {hasData && (
        <div
          className="sticky top-20 z-30 flex flex-wrap items-center gap-1.5 rounded-xl border bg-white/95 px-3 py-2 shadow-md backdrop-blur"
          style={{ borderColor: theme.primary }}
        >
          {Object.entries(metricThemes).map(([key, metric]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedMetric === key ? `${metric.bg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {metric.label}
            </button>
          ))}
          <div className="mx-1 hidden h-6 w-px bg-gray-200 md:block" />
          {hasHealthThreshold(selectedMetric) && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: getColorForValue(avgValue, selectedMetric), color: '#1F2937' }}
            >
              Avg: {getStatusLabel(avgValue, selectedMetric)}
            </span>
          )}
          {activeTab === 'overview' && (
            <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
              {[
                ['recent', 'Recent'],
                ['trends', 'Trends'],
                ['distribution', 'Distribution'],
                ['box', 'Box plot'],
                ['scatter', 'Scatter'],
                ['insights', 'Insights'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSection(key)}
                  aria-expanded={openSections[key]}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    openSections[key] ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                  <ChevronDown className={`h-3 w-3 transition-transform ${openSections[key] ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conditional Content based on Active Tab */}
      {!hasData ? (
        <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-200 text-center max-w-2xl mx-auto">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No data for Analysis yet</h2>
          <p className="text-gray-600 mb-4">
            With your current filters, there are no measurements. Collect sessions in the field or import CSV on{' '}
            <strong>Raw Data</strong>, then come back here.
          </p>
          <p className="text-sm text-gray-500">
            We no longer show placeholder charts — the Analysis page only uses <strong>your</strong> workspace data.
            When you have data, you can compare it to Philadelphia, New York, or Hanoi reference trends.
          </p>
        </div>
      ) : activeTab === 'overview' ? (
        <>
          {/* One thin summary strip instead of four oversized cards. */}
          <div className="flex flex-wrap items-center divide-x divide-gray-200 rounded-xl border bg-white px-2 py-2 shadow-sm">
            {[
              ['Average', avgValue, theme.primary],
              ['Median', Math.round(medianValue), '#9333EA'],
              ['Minimum', Math.round(minValue), '#16A34A'],
              ['Maximum', Math.round(maxValue), '#EA580C'],
            ].map(([label, value, color]) => (
              <div key={label} className="flex min-w-[130px] flex-1 items-baseline justify-between gap-2 px-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
                <span className="text-lg font-bold" style={{ color }}>
                  {value} <span className="text-[10px] font-medium text-gray-400">{metricThemes[selectedMetric].unit}</span>
                </span>
              </div>
            ))}
          </div>

      {/* Outlier / surprising-reading callouts */}
      {dailyOutliers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">Surprising readings to investigate</h3>
          </div>
          <ul className="text-sm text-amber-800 space-y-1">
            {dailyOutliers.slice(0, 5).map((o, idx) => (
              <li key={idx}>
                • <strong>{o.point.date}</strong>: {o.value} {metricThemes[selectedMetric].unit} — unusually{' '}
                {o.direction === 'high' ? 'high' : 'low'} compared to the rest of this series.
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            Flagged using the 1.5×IQR rule — a starting point for discussion, not a definitive error.
          </p>
        </div>
      )}

      {/* Charts Grid — your recent week vs reference; your full series */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {openSections.recent && (
        <div ref={weekChartRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent week vs {referenceLocation} ({metricThemes[selectedMetric].label})
              </h2>
              <div className="relative">
                <button
                  type="button"
                  aria-label="About this comparison"
                  aria-expanded={showReferenceInfo}
                  aria-controls="reference-comparison-info"
                  onClick={() => setShowReferenceInfo((visible) => !visible)}
                  className="mt-0.5 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Info className="h-4 w-4" />
                </button>
                {showReferenceInfo && (
                  <div
                    id="reference-comparison-info"
                    role="note"
                    className="absolute left-0 top-8 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-xl"
                  >
                    <strong>Your data</strong> uses the current measurement filters. The reference line uses OpenAQ daily
                    averages when a matching sensor exists; otherwise it shows a simulated regional curve.
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <SaveChartButton
                targetRef={weekChartRef}
                filename={`recent-week-vs-${referenceLocation}-${metricThemes[selectedMetric].label}`}
              />
              <SendToWorkspaceButton
                onSendToWorkspace={onSendToWorkspace}
                buildItem={() => ({
                  id: `week-ref-${selectedMetric}-${Date.now()}`,
                  title: `Recent week vs ${referenceLocation} (${metricThemes[selectedMetric].label})`,
                  subtitle: `${metricThemes[selectedMetric].unit} · current filters`,
                  kind: 'line',
                  data: weekCompareData.map((d) => ({ label: d.label, yours: d.yours, reference: d.reference })),
                  xKey: 'label',
                  xLabel: 'Day',
                  yLabel: metricThemes[selectedMetric].unit,
                  series: [
                    { dataKey: 'yours', label: 'Your data', color: theme.primary },
                    { dataKey: 'reference', label: 'Reference', color: '#94a3b8' },
                  ],
                })}
              />
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
              <MapPin className="h-4 w-4 text-gray-500" aria-hidden="true" />
              Reference location
              <select
                value={referenceLocation}
                onChange={(e) => setReferenceLocation(e.target.value)}
                className="max-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              >
                {REFERENCE_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            {OPENAQ_REFERENCE_METRICS.includes(selectedMetric) && openaqMeta.status === 'loading' && (
              <p className="text-xs text-blue-600">Loading OpenAQ reference…</p>
            )}
            {OPENAQ_REFERENCE_METRICS.includes(selectedMetric) && openaqMeta.status === 'ok' && (
              <p className="text-xs text-green-700">{openaqMeta.message}</p>
            )}
            {OPENAQ_REFERENCE_METRICS.includes(selectedMetric) && openaqMeta.status === 'error' && (
              <p className="text-xs text-amber-700">{openaqMeta.message}</p>
            )}
          </div>
          {weekCompareData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weekCompareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  label={{ value: 'Day', position: 'insideBottom', offset: -2, style: { fill: '#6B7280', fontSize: '11px' } }}
                  {...AXIS_LINE_PROPS}
                />
                <YAxis
                  label={{
                    value: metricThemes[selectedMetric].unit,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' },
                  }}
                  {...AXIS_LINE_PROPS}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    padding: '12px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="yours" name="Your data" stroke={theme.primary} strokeWidth={3} dot={{ r: 4 }} />
                <Line
                  type="monotone"
                  dataKey="reference"
                  name={
                    OPENAQ_REFERENCE_METRICS.includes(selectedMetric) &&
                    openaqMeta.status === 'ok' &&
                    openaqPoints?.length
                      ? 'Reference (OpenAQ)'
                      : 'Reference (simulated)'
                  }
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">Not enough dated points in this filter for a week chart.</p>
          )}
          <ReflectionPrompt storageKey={`week-vs-ref-${selectedMetric}`} mode="notice-wonder" />
        </div>
        )}

        {openSections.trends && (
        <div ref={monthChartRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Your measurements over time</h2>
            <div className="flex items-center gap-1.5">
              <SaveChartButton
                targetRef={monthChartRef}
                filename={`time-series-${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}`}
              />
              <SendToWorkspaceButton
                onSendToWorkspace={onSendToWorkspace}
                buildItem={() => ({
                  id: `over-time-${selectedMetric}-${Date.now()}`,
                  title: `Your measurements over time — ${metricThemes[selectedMetric].label}`,
                  kind: 'line',
                  data: monthData,
                  xKey: 'date',
                  xLabel: 'Date',
                  yLabel: metricThemes[selectedMetric].unit,
                  series: [{ dataKey: 'value', label: 'Your data', color: theme.primary }],
                })}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Daily average for the selected metric (all days in your current filter).</p>
          {monthData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  style={{ fontSize: '10px' }}
                  stroke="#9CA3AF"
                  tickLine={true}
                  axisLine={{ stroke: '#9CA3AF' }}
                  interval={4}
                  label={{ value: 'Date', position: 'insideBottom', offset: -2, style: { fill: '#6B7280', fontSize: '11px' } }}
                />
                <YAxis
                  label={{
                    value: metricThemes[selectedMetric].unit,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' },
                  }}
                  {...AXIS_LINE_PROPS}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    padding: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Your data"
                  stroke={theme.primary}
                  strokeWidth={2}
                  dot={{ fill: theme.primary, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 py-12 text-center">
              Add more days of data (or relax filters) to see a time series.
            </p>
          )}
        </div>
        )}
      </div>

      {/* Distribution Analysis */}
      {openSections.distribution && (
      <div ref={distributionChartRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Value Distribution</h2>
            <p className="text-xs text-gray-500">
              How your {metricThemes[selectedMetric].label} readings ({metricThemes[selectedMetric].unit}) spread across ranges.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <SaveChartButton
              targetRef={distributionChartRef}
              filename={`${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}-value-distribution`}
            />
            <SendToWorkspaceButton
              onSendToWorkspace={onSendToWorkspace}
              buildItem={() => ({
                id: `distribution-${selectedMetric}-${Date.now()}`,
                title: `Value distribution — ${metricThemes[selectedMetric].label}`,
                kind: 'bar',
                xKey: 'range',
                xLabel: `${metricThemes[selectedMetric].label} range (${metricThemes[selectedMetric].unit})`,
                yLabel: 'Count',
                color: theme.primary,
                data: [
                  { range: '0-10', value: allValues.filter((v) => v >= 0 && v <= 10).length },
                  { range: '11-15', value: allValues.filter((v) => v > 10 && v <= 15).length },
                  { range: '16-20', value: allValues.filter((v) => v > 15 && v <= 20).length },
                  { range: '21-25', value: allValues.filter((v) => v > 20 && v <= 25).length },
                  { range: '26+', value: allValues.filter((v) => v > 25).length },
                ],
              })}
            />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={[
            { range: '0-10', count: allValues.filter(v => v >= 0 && v <= 10).length },
            { range: '11-15', count: allValues.filter(v => v > 10 && v <= 15).length },
            { range: '16-20', count: allValues.filter(v => v > 15 && v <= 20).length },
            { range: '21-25', count: allValues.filter(v => v > 20 && v <= 25).length },
            { range: '26+', count: allValues.filter(v => v > 25).length }
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="range"
              label={{
                value: `${metricThemes[selectedMetric].label} range (${metricThemes[selectedMetric].unit})`,
                position: 'insideBottom',
                offset: -2,
                style: { fill: '#6B7280', fontSize: '11px' },
              }}
              {...AXIS_LINE_PROPS}
            />
            <YAxis
              label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' } }}
              {...AXIS_LINE_PROPS}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'white', 
                border: 'none', 
                borderRadius: '12px', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                padding: '12px'
              }} 
            />
            <Bar dataKey="count" fill={theme.primary} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Box Plot — variability/distribution per team in the current class period */}
      {openSections.box && (
      <div ref={boxPlotRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Variability by team (box plot)</h2>
            <p className="text-xs text-gray-500">
              Min / Q1 / median / Q3 / max of {metricThemes[selectedMetric].label} for each team in your class period.
            </p>
          </div>
          {boxPlotGroups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <SaveChartButton
                targetRef={boxPlotRef}
                filename={`${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}-box-plot-by-team`}
              />
              <SendToWorkspaceButton
                onSendToWorkspace={onSendToWorkspace}
                buildItem={() => ({
                  id: `box-${selectedMetric}-${Date.now()}`,
                  title: `Variability by team — ${metricThemes[selectedMetric].label}`,
                  kind: 'box',
                  groups: boxPlotGroups,
                  unit: metricThemes[selectedMetric].unit,
                  color: theme.primary,
                })}
              />
            </div>
          )}
        </div>
        <BoxPlot groups={boxPlotGroups} unit={metricThemes[selectedMetric].unit} color={theme.primary} />
      </div>
      )}

      {/* Bivariate / scatter — relationship between two variables */}
      {openSections.scatter && (
      <div ref={scatterChartRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {metricThemes[selectedMetric].label} vs {metricThemes[scatterMetric].label}
            </h2>
            <p className="text-xs text-gray-500">Each point is one measurement, colored by team.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-500">Compare with:</span>
            <select
              value={scatterMetric}
              onChange={(e) => setScatterMetric(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              {Object.entries(metricThemes)
                .filter(([key]) => key !== selectedMetric)
                .map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label}
                  </option>
                ))}
            </select>
            {scatterData.length > 0 && (
              <>
              <SaveChartButton
                targetRef={scatterChartRef}
                filename={`${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}-vs-${metricThemes[scatterMetric].label}-${metricThemes[scatterMetric].unit}`}
              />
              <SendToWorkspaceButton
                onSendToWorkspace={onSendToWorkspace}
                buildItem={() => ({
                  id: `scatter-${selectedMetric}-${scatterMetric}-${Date.now()}`,
                  title: `${metricThemes[selectedMetric].label} vs ${metricThemes[scatterMetric].label}`,
                  kind: 'scatter',
                  data: scatterData,
                  xLabel: `${metricThemes[selectedMetric].label} (${metricThemes[selectedMetric].unit})`,
                  yLabel: `${metricThemes[scatterMetric].label} (${metricThemes[scatterMetric].unit})`,
                  color: theme.primary,
                })}
              />
              </>
            )}
          </div>
        </div>
        {scatterData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                type="number"
                dataKey="x"
                name={metricThemes[selectedMetric].label}
                label={{
                  value: `${metricThemes[selectedMetric].label} (${metricThemes[selectedMetric].unit})`,
                  position: 'insideBottom',
                  offset: -2,
                  style: { fill: '#6B7280', fontSize: '11px' },
                }}
                {...AXIS_LINE_PROPS}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={metricThemes[scatterMetric].label}
                label={{
                  value: `${metricThemes[scatterMetric].label} (${metricThemes[scatterMetric].unit})`,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' },
                }}
                {...AXIS_LINE_PROPS}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '12px' }}
              />
              <Scatter data={scatterData} fill={theme.primary} fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500 py-12 text-center">Not enough matching data points for a scatter plot yet.</p>
        )}
        <ReflectionPrompt storageKey={`scatter-${selectedMetric}-${scatterMetric}`} mode="cer" />
      </div>
      )}

      {/* Summary Insights */}
      {openSections.insights && (
      <div 
        className="rounded-2xl p-8 shadow-lg border-2"
        style={{ 
          background: `linear-gradient(135deg, ${theme.light} 0%, white 100%)`,
          borderColor: theme.primary
        }}
      >
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
          Key Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Statistical Summary:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span style={{ color: theme.primary }}>•</span>
                <span>Average {metricThemes[selectedMetric].label} is <strong>{avgValue} {metricThemes[selectedMetric].unit}</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: theme.primary }}>•</span>
                <span>Values range from <strong>{Math.round(minValue)}</strong> to <strong>{Math.round(maxValue)} {metricThemes[selectedMetric].unit}</strong></span>
              </li>
              {hasHealthThreshold(selectedMetric) && (
                <li className="flex items-start gap-2">
                  <span style={{ color: theme.primary }}>•</span>
                  <span>
                    Your average reads as <strong>{getStatusLabel(avgValue, selectedMetric)}</strong> on the health-threshold scale
                  </span>
                </li>
              )}
              {dailyOutliers.length > 0 && (
                <li className="flex items-start gap-2">
                  <span style={{ color: theme.primary }}>•</span>
                  <span>{dailyOutliers.length} surprising reading{dailyOutliers.length > 1 ? 's' : ''} flagged above — worth discussing</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Observations:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-none text-green-600" aria-hidden="true" />
                <span>Data collected over {allValues.length} time points</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-none text-green-600" aria-hidden="true" />
                <span>Median value of {Math.round(medianValue)} shows central tendency</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-none text-green-600" aria-hidden="true" />
                <span>Open the <strong>Trends</strong> section above for the full daily series</span>
              </li>
            </ul>
          </div>
        </div>
        <ReflectionPrompt storageKey={`overview-summary-${selectedMetric}`} mode="cer" title="Claim, Evidence, Reasoning about this metric" />
      </div>
      )}
        </>
      ) : (
        /* Quick Compare View */
        <div className="space-y-6">
          {/* Quick Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Your Group */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border-2`} style={{ borderColor: theme.primary }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Your Group</h3>
                <span className={`px-3 py-1 ${theme.bg} text-white text-sm font-semibold rounded-full`}>
                  G{filters.group.replace('G', '')}
                </span>
              </div>
              <div className="mb-4">
                <p className="text-4xl font-bold mb-1" style={{ color: theme.primary }}>{avgValue}</p>
                <p className="text-sm text-gray-600">{metricThemes[selectedMetric].unit}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Min</span>
                  <span className="font-semibold text-green-600">{Math.round(minValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max</span>
                  <span className="font-semibold text-orange-600">{Math.round(maxValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Range</span>
                  <span className="font-semibold text-gray-900">{Math.round(maxValue - minValue)}</span>
                </div>
              </div>
            </div>

            {/* Class Average */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Class Average</h3>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
                  All Groups
                </span>
              </div>
              <div className="mb-4">
                <p className="text-4xl font-bold text-purple-600 mb-1">{classAverage ?? 'NO DATA'}</p>
                {classAverage != null && (
                  <p className="text-sm text-gray-600">{metricThemes[selectedMetric].unit}</p>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs text-gray-500">
                  Average across all groups in your class period (same school + period in imported data).
                </p>
                <div className="flex justify-between">
                  <span className="text-gray-600">vs your group</span>
                  <span className="font-semibold text-gray-900">
                    {classAverage != null
                      ? avgValue <= classAverage
                        ? `${Math.abs(avgValue - classAverage)} lower`
                        : `${Math.abs(avgValue - classAverage)} higher`
                      : 'NO DATA'}
                  </span>
                </div>
              </div>
            </div>

            {/* School Average */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">School Average</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                  {filters.school}
                </span>
              </div>
              <div className="mb-4">
                <p className="text-4xl font-bold text-blue-600 mb-1">{schoolAverage ?? 'NO DATA'}</p>
                {schoolAverage != null && (
                  <p className="text-sm text-gray-600">{metricThemes[selectedMetric].unit}</p>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs text-gray-500">
                  Average for your school code across imported rows (all classes/groups in file).
                </p>
                <div className="flex justify-between">
                  <span className="text-gray-600">vs your group</span>
                  <span className="font-semibold text-gray-900">
                    {schoolAverage != null
                      ? avgValue <= schoolAverage
                        ? `${Math.abs(avgValue - schoolAverage)} lower`
                        : `${Math.abs(avgValue - schoolAverage)} higher`
                      : 'NO DATA'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Chart */}
          <div ref={quickCompareChartRef} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Your recent week comparison</h3>
                <p className="text-xs text-gray-500">
                  Compare your filtered data with OpenAQ, another group, class average, or school average.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={compareMode}
                  onChange={(e) => setCompareMode(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="openaq">vs OpenAQ reference</option>
                  <option value="group">vs another group</option>
                  <option value="class">vs class average</option>
                  <option value="school">vs school average</option>
                </select>
                {compareMode === 'group' && (
                  <select
                    value={compareGroup}
                    onChange={(e) => setCompareGroup(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {availableCompareGroups.length ? (
                      availableCompareGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))
                    ) : (
                      <option value="">NO DATA</option>
                    )}
                  </select>
                )}
                <SaveChartButton
                  targetRef={quickCompareChartRef}
                  filename={`${metricThemes[selectedMetric].label}-${metricThemes[selectedMetric].unit}-quick-compare-${compareMode}`}
                />
                <SendToWorkspaceButton
                  onSendToWorkspace={onSendToWorkspace}
                  buildItem={() => ({
                    id: `quick-compare-${compareMode}-${selectedMetric}-${Date.now()}`,
                    title: `Quick compare (${compareMode}) — ${metricThemes[selectedMetric].label}`,
                    kind: 'line',
                    data: compareChartData,
                    xKey: 'day',
                    xLabel: 'Day',
                    yLabel: metricThemes[selectedMetric].unit,
                    series: [
                      { dataKey: 'yours', label: 'Your data', color: theme.primary },
                      { dataKey: 'comparison', label: 'Comparison', color: '#64748b' },
                    ],
                  })}
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={compareChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="day"
                  label={{ value: 'Day', position: 'insideBottom', offset: -2, style: { fill: '#6B7280', fontSize: '11px' } }}
                  {...AXIS_LINE_PROPS}
                />
                <YAxis
                  label={{
                    value: metricThemes[selectedMetric].unit,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#6B7280', fontSize: '12px' },
                  }}
                  {...AXIS_LINE_PROPS}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    padding: '12px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="yours"
                  name="Your data"
                  stroke={theme.primary}
                  strokeWidth={3}
                  dot={{ fill: theme.primary, r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="comparison"
                  name={
                    compareMode === 'openaq'
                      ? 'OpenAQ / reference'
                      : compareMode === 'group'
                        ? `Group ${compareGroup || ''}`
                        : compareMode === 'class'
                          ? 'Class average'
                          : 'School average'
                  }
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#64748b', r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <ReflectionPrompt storageKey={`quick-compare-${compareMode}-${selectedMetric}`} mode="cer" />
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl p-6 shadow-lg border border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Quick read</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">•</span>
                  <span>
                    <strong>Your group</strong> average for this metric: {avgValue} {metricThemes[selectedMetric].unit}.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">•</span>
                  <span>
                    {classAverage != null
                      ? `Class-wide (same period) average is ${classAverage} ${metricThemes[selectedMetric].unit}.`
                      : 'Class average needs more imported rows (other groups in the same period).'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 shadow-lg border border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Compare further</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>
                    On <strong>Overview</strong>, compare the recent week with Philadelphia, New York, or Hanoi.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Use the compare mode selector above to switch between OpenAQ, other groups, class, and school.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CTA for Full Comparison */}
          <div className={`bg-gradient-to-r ${theme.bg} ${theme.hover} rounded-2xl p-6 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Want to explore more comparisons?</h3>
                <p className="text-sm opacity-90">Compare with other schools, locations, and time periods</p>
              </div>
              <button
                onClick={() => setShowCompareModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-md"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                Open detailed comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ComparisonModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        selectedMetric={selectedMetric}
        theme={theme}
        metricThemes={metricThemes}
        currentFilters={filters}
        workspaceGroups={workspaceGroupsForCompare}
        comparisonSchoolCodes={comparisonSchoolCodes}
        importedRows={imported}
      />
    </div>
  );
};

export default AnalysisView;