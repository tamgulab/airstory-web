import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Download, Filter, Search, Calendar, ChevronDown, TrendingUp, TrendingDown, ChevronRight, Image as ImageIcon, X, Upload, Share2, Lock, SlidersHorizontal } from 'lucide-react';
import { addMeasurementEdit, clearWorkspaceMeasurements, getMeasurements, importCsvMeasurements } from '../api/data';
import {
  clearImportedMeasurements,
  getImportedMeasurements,
  parseImportedCsv,
  parseImportedCsvRaw,
  setImportedMeasurements,
  normalizeIndoorOutdoor,
  uniqueHierarchyFromImportedRows,
} from '../utils/importedData';
import { workspaceMeasurementsToDisplayRows } from '../utils/measurementRows';
import DataCalendar from './DataCalendar';
import ConfirmDialog from './ConfirmDialog';
import {
  SENSOR_CSV_EXPORT_HEADERS,
  csvEscapeCell,
} from '../constants/sensorCsv';
// DEV ONLY - MOCK DATA - REMOVE BEFORE DEPLOY
import {
  MOCK_DATA_ENABLED,
  MOCK_IDENTITY,
  MOCK_MEASUREMENTS,
  isRowVisibleToViewer,
} from '../constants/mockMeasurements';

const CSV_UPLOAD_CHUNK_SIZE = 2500;

// Toolbar config (Section 2)
const METRIC_KEYS = [
  { key: 'pm25', label: 'PM2.5' },
  { key: 'co', label: 'CO' },
  { key: 'humidity', label: 'Humidity' },
  { key: 'temp', label: 'Temperature' },
];
const ALL_METRICS_ON = { pm25: true, co: true, temp: true, humidity: true };

// A "class" is a (teacher · period) pair → this key never lets period stand alone.
const ck = (instructor, period) => `${instructor}|${period}`;

// TODO(backend): the backend stores temperature in CELSIUS only. The °C/°F choice is a
// client-side display preference — convert at render, never change stored data.
const cToF = (c) => Math.round((Number(c) * 9) / 5 + 32);
const fToC = (f) => Math.round(((Number(f) - 32) * 5) / 9);

// Read-only visibility pills (Section 4). Visibility is set on the phone before upload.
// TODO(backend): replace mock `visibility` with the real `visibility` field once
// GET /workspaces/:id/measurements returns it (see mockMeasurements.js).
// Three levels: Group only (default) | School only | Public.
// TODO(researcher-mode): 'class'/'me' removed for now — reserved for a future researcher mode.
const VISIBILITY_META = {
  group: { label: 'Group only', cls: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  school: { label: 'School only', cls: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  public: { label: 'Public', cls: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
};
const VISIBILITY_OPTIONS = ['group', 'school', 'public']; // Group only is the default

const INDOOR_OUTDOOR_OPTIONS = ['INDOOR', 'OUTDOOR'];

const RawDataView = ({
  workspaceId,
  viewerProfile,
  selectedMetric,
  setSelectedMetric,
  filters,
  setFilters,
  theme,
  metricThemes,
  onImportedDataChanged,
}) => {
  const [rawData, setRawData] = useState(() => {
    const imported = getImportedMeasurements();
    // DEV ONLY - MOCK DATA: seed the redesign with stub rows when nothing is imported.
    if (MOCK_DATA_ENABLED && imported.length === 0) return MOCK_MEASUREMENTS;
    return imported;
  });
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [importError, setImportError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedDatesDraft, setSelectedDatesDraft] = useState(() => new Set());
  const [locationFilter, setLocationFilter] = useState('all');

  // Hierarchy Filters (kept only for CSV export filename + filters sync)
  const [selectedSchool, setSelectedSchool] = useState(filters.school || '');
  const [selectedInstructor, setSelectedInstructor] = useState(filters.instructor || '');
  const [selectedPeriod, setSelectedPeriod] = useState(filters.period || '');
  const [selectedGroup, setSelectedGroup] = useState(filters.group || '');

  // --- Redesign: viewer identity + scope (Group / Class / School) ---
  // DEV ONLY - MOCK DATA: identity comes from the mock student until real auth carries it.
  const viewerIdentity = useMemo(() => (
    MOCK_DATA_ENABLED
      ? MOCK_IDENTITY
      : {
          school: viewerProfile?.school || '',
          studentCode: viewerProfile?.studentId || '',
          memberships: [
            {
              instructor: viewerProfile?.instructor || '',
              period: viewerProfile?.period || '',
              group: viewerProfile?.group || '',
            },
          ],
        }
  ), [viewerProfile]);
  const primaryMembership = viewerIdentity.memberships[0] || { instructor: '', period: '', group: '' };
  const viewerClassKeys = viewerIdentity.memberships.map((m) => ck(m.instructor, m.period));

  const [scopeTab, setScopeTab] = useState('group'); // 'group' | 'class' | 'school' (Group is the landing default)
  const [scopeClassKey, setScopeClassKey] = useState(ck(primaryMembership.instructor, primaryMembership.period));
  const [scopeGroup, setScopeGroup] = useState(primaryMembership.group);

  // Shared scope + visibility predicates (used by the table AND the scope-aware Location options).
  const rowVisible = (row) => isRowVisibleToViewer(row, viewerIdentity);
  const rowInScope = (row) =>
    scopeTab === 'school'
      ? row.school === viewerIdentity.school
      : scopeTab === 'class'
        ? ck(row.instructor, row.period) === scopeClassKey
        : ck(row.instructor, row.period) === scopeClassKey && row.group === scopeGroup;

  // Toolbar: draft values (bound to inputs) vs applied values (used by the table).
  // Search/date/location/metrics only take effect on [Apply]. Scope tabs are immediate.
  const [metricsDraft, setMetricsDraft] = useState(ALL_METRICS_ON);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedDates, setAppliedDates] = useState(() => new Set());
  const [appliedLocation, setAppliedLocation] = useState('all');
  const [appliedMetrics, setAppliedMetrics] = useState(ALL_METRICS_ON);
  const [openChip, setOpenChip] = useState(null); // 'date' | 'metrics' | 'location' | null
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // Shared confirmation for any destructive action: { variant, title, message, confirmLabel, onConfirm } | null
  const [confirmState, setConfirmState] = useState(null);
  const [visibilityMenu, setVisibilityMenu] = useState(null); // rowId whose visibility menu is open
  // Empty-by-default: no sessions shown until the student engages (picks a scope tab/selector or applies filters).
  const [hasEngaged, setHasEngaged] = useState(false);

  // Display preferences — view-only, this session (in-memory). Data underneath is unchanged.
  // TODO(persist): a saved user preference would attach to the user profile (or localStorage);
  // initialize these from there instead of constants once that exists.
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F' — display only; data stays Celsius
  const [dateFormat, setDateFormat] = useState('ymd'); // 'ymd' | 'mdy'
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);

  // Render-time converters that follow the display preferences.
  const tempUnitLabel = tempUnit === 'F' ? '°F' : '°C';
  const displayTemp = (c) => (tempUnit === 'F' ? cToF(c) : Math.round(Number(c)));
  const tempInputToC = (v) => (tempUnit === 'F' ? fToC(v) : v);
  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const mo = p(d.getMonth() + 1);
    const da = p(d.getDate());
    const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    return `${dateFormat === 'mdy' ? `${mo}-${da}-${y}` : `${y}-${mo}-${da}`} ${time}`;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [editingNotes, setEditingNotes] = useState(null);
  const [editingCell, setEditingCell] = useState({ rowId: null, field: null });
  const [editedCells, setEditedCells] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const itemsPerPage = 50;
  const importGenerationRef = useRef(0);

  const loadFromBackend = useCallback(async () => {
    if (!workspaceId) return;
    const genAtStart = importGenerationRef.current;
    setLoadingBackend(true);
    try {
      const result = await getMeasurements(workspaceId, { limit: 10000 });
      if (genAtStart !== importGenerationRef.current) return;
      const mapped = workspaceMeasurementsToDisplayRows(result.measurements || []);
      if (mapped.length) {
        setRawData(mapped);
        setImportedMeasurements(mapped);
        onImportedDataChanged?.();
      }
    } catch {
      // Fall back to imported CSV data when backend is unavailable.
    } finally {
      if (genAtStart === importGenerationRef.current) {
        setLoadingBackend(false);
      }
    }
  }, [workspaceId, onImportedDataChanged]);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  React.useEffect(() => {
    setSelectedSchool(filters.school || '');
    setSelectedInstructor(filters.instructor || '');
    setSelectedPeriod(filters.period || '');
    setSelectedGroup(filters.group || '');
  }, [filters.school, filters.instructor, filters.period, filters.group]);

  // Locations for the Location chip — only sessions visible in the current scope,
  // further narrowed by the DRAFT date selection (chips narrow each other live, before Apply).
  // Metrics are column toggles, not row filters, so they don't change available locations.
  const locations = useMemo(() => {
    const inScope = (r) =>
      scopeTab === 'school'
        ? r.school === viewerIdentity.school
        : scopeTab === 'class'
          ? ck(r.instructor, r.period) === scopeClassKey
          : ck(r.instructor, r.period) === scopeClassKey && r.group === scopeGroup;
    return [...new Set(
      rawData
        .filter((r) => inScope(r) && isRowVisibleToViewer(r, viewerIdentity))
        .filter((r) => selectedDatesDraft.size === 0 || selectedDatesDraft.has(r.date))
        .map((d) => d.location)
    )];
  }, [rawData, scopeTab, scopeClassKey, scopeGroup, selectedDatesDraft, viewerIdentity]);

  // If the drafted location is no longer available (scope or date draft changed), deselect it.
  useEffect(() => {
    if (locationFilter !== 'all' && !locations.includes(locationFilter)) {
      setLocationFilter('all');
    }
  }, [locations, locationFilter]);

  // Dates that have data → drives the calendar's bold/selectable days (Section 3).
  const dataDates = new Set(rawData.map((d) => d.date));

  // Class-periods (teacher · period) present in the school → drives the Class tab.
  const schoolRows = rawData.filter((r) => r.school === viewerIdentity.school);
  const classPeriods = [];
  const seenClass = new Set();
  schoolRows.forEach((r) => {
    const key = ck(r.instructor, r.period);
    if (r.instructor && r.period && !seenClass.has(key)) {
      seenClass.add(key);
      classPeriods.push({ key, label: `${r.instructor} · ${r.period}` });
    }
  });
  classPeriods.sort((a, b) => a.label.localeCompare(b.label));

  // Groups within the currently selected class context → drives the Group tab.
  const groupsForSelectedClass = [...new Set(
    schoolRows.filter((r) => ck(r.instructor, r.period) === scopeClassKey).map((r) => r.group).filter(Boolean)
  )].sort();

  // The viewer's own group within a given class-period (empty if not a member).
  const viewerGroupForClass = (key) => {
    const m = viewerIdentity.memberships.find((mm) => ck(mm.instructor, mm.period) === key);
    return m ? m.group : '';
  };
  const selectedClassLabel = classPeriods.find((c) => c.key === scopeClassKey)?.label || '';

  // Switching class context resets the Group default to follow it.
  const selectClassContext = (key) => {
    setScopeClassKey(key);
    const ownGroup = viewerGroupForClass(key);
    const groups = [...new Set(
      schoolRows.filter((r) => ck(r.instructor, r.period) === key).map((r) => r.group).filter(Boolean)
    )].sort();
    setScopeGroup(ownGroup || groups[0] || '');
    setHasEngaged(true);
  };
  

  // Filter data
  let filteredData = rawData.filter(row => {
    const q = appliedSearch.toLowerCase();
    const matchesSearch =
      String(row.location || '').toLowerCase().includes(q) ||
      `${row.latitude}, ${row.longitude}`.includes(appliedSearch) ||
      String(row.sessionId || '').toLowerCase().includes(q) ||
      row.sessionName.toLowerCase().includes(q) ||
      row.date.includes(appliedSearch) ||
      row.group.toLowerCase().includes(q) ||
      row.school.toLowerCase().includes(q) ||
      row.instructor.toLowerCase().includes(q) ||
      row.period.toLowerCase().includes(q);

    const matchesLocation = appliedLocation === 'all' || row.location === appliedLocation;

    // Scope tab (Group / Class / School) + visibility — shared with the Location options.
    const matchesScope = rowInScope(row);
    const matchesVisibility = rowVisible(row);
    
    // Date: no dates picked = no date filter; otherwise the row's date must be selected.
    const matchesDate = appliedDates.size === 0 || appliedDates.has(row.date);

    return matchesSearch && matchesLocation && matchesDate &&
           matchesScope && matchesVisibility;
  });

  // Sort data
  if (sortConfig.key) {
    filteredData.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'capturedAt') {
        aVal = new Date(a.capturedAt || `${a.date}T${a.time || '00:00'}`).getTime();
        bVal = new Date(b.capturedAt || `${b.date}T${b.time || '00:00'}`).getTime();
      } else if (sortConfig.key === 'latitude' || sortConfig.key === 'longitude') {
        aVal = parseFloat(a[sortConfig.key]);
        bVal = parseFloat(b[sortConfig.key]);
      } else if (sortConfig.key === 'pm25' || sortConfig.key === 'co' || sortConfig.key === 'temp' || sortConfig.key === 'humidity') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Empty-by-default: only show sessions once the student has engaged.
  const viewRows = hasEngaged ? filteredData : [];

  // Pagination
  const totalPages = Math.max(1, Math.ceil(viewRows.length / itemsPerPage));
  React.useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);
  const paginatedData = viewRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const applyFilters = () => {
    setAppliedSearch(searchTerm);
    setAppliedDates(new Set(selectedDatesDraft));
    setAppliedLocation(locationFilter);
    setAppliedMetrics(metricsDraft);
    setOpenChip(null);
    setCurrentPage(1);
    setHasEngaged(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDatesDraft(new Set());
    setLocationFilter('all');
    setMetricsDraft(ALL_METRICS_ON);
    setAppliedSearch('');
    setAppliedDates(new Set());
    setAppliedLocation('all');
    setAppliedMetrics(ALL_METRICS_ON);
    setOpenChip(null);
    setCurrentPage(1);
    setHasEngaged(false); // back to the empty default state
  };

  // Build the CSV for the CURRENT VIEW (the visible sessions), full column set.
  const buildExportCsv = () => {
    const rows = [];
    viewRows.forEach((row) => {
      const detailed = generateDetailedData(row);
      detailed.forEach((second) => {
        const indoorOutdoorLabel =
          row.indoorOutdoor === 'INDOOR' ? 'Indoor' : 'Outdoor';
        const line = [
          csvEscapeCell(`${row.date} ${second.time}`),
          csvEscapeCell(row.date),
          csvEscapeCell(second.time),
          csvEscapeCell(row.sessionId),
          csvEscapeCell(row.sessionName),
          csvEscapeCell(row.school),
          csvEscapeCell(row.instructor),
          csvEscapeCell(row.period),
          csvEscapeCell(row.group),
          csvEscapeCell(row.location),
          csvEscapeCell(row.latitude),
          csvEscapeCell(row.longitude),
          csvEscapeCell(indoorOutdoorLabel),
          csvEscapeCell(second.pm25),
          csvEscapeCell(second.co),
          csvEscapeCell(second.temp),
          csvEscapeCell(second.humidity),
        ].join(',');
        rows.push(line);
      });
    });

    const csvContent = [SENSOR_CSV_EXPORT_HEADERS.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const schoolStr = selectedSchool || filters.school || 'ALL';
    const instructorStr = selectedInstructor || filters.instructor || 'ALL';
    const periodStr = selectedPeriod || filters.period || 'ALL';
    const groupStr = selectedGroup || filters.group || 'ALL';
    const filename = `air-quality-data-${dateStr}-${schoolStr}-${instructorStr}-${periodStr}-${groupStr}.csv`;
    return { csvContent, filename };
  };

  const downloadCsvFile = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export menu → "Download CSV": standard browser download.
  const handleDownloadCsv = () => {
    const { csvContent, filename } = buildExportCsv();
    downloadCsvFile(csvContent, filename);
    setExportMenuOpen(false);
  };

  // Export menu → "Save CSV as…": native file picker where supported (Chrome/Edge);
  // silent fallback to a normal download elsewhere (Safari/Firefox).
  const handleSaveCsvAs = async () => {
    const { csvContent, filename } = buildExportCsv();
    setExportMenuOpen(false);
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user cancelled the picker
        // any other error → fall through to a normal download
      }
    }
    downloadCsvFile(csvContent, filename);
  };

  // Share the current filtered CSV via the device share sheet; fall back to a
  // download + a pre-filled mailto draft where file sharing is unsupported.
  const handleShareCsv = async () => {
    const { csvContent, filename } = buildExportCsv();
    const file = new File([csvContent], filename, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: 'AirStory data export' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user dismissed the share sheet
        // any other error → fall through to the mailto fallback
      }
    }
    downloadCsvFile(csvContent, filename);
    const subject = encodeURIComponent('AirStory data export');
    const body = encodeURIComponent(
      `The AirStory data export (${filename}) has been downloaded to your device.\n\n` +
        'Please attach that file to this email before sending.'
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rawRows = parseImportedCsvRaw(text);
      const imported = parseImportedCsv(text).map((r) => ({
        ...r,
        // CSV imports are teacher bulk loads → default to "School only".
        // (App uploads / new classes use the model default, "Group only".)
        visibility: r.visibility || 'school',
      }));
      importGenerationRef.current += 1;
      // Always show imported data in UI immediately.
      setRawData(imported);
      setImportedMeasurements(imported);
      onImportedDataChanged?.();
      setImportError('');
      // Historical CSVs are often hidden by date/location chips; widen filters after import.
      setSelectedDatesDraft(new Set());
      setLocationFilter('all');
      setSearchTerm('');
      setAppliedDates(new Set());
      setAppliedLocation('all');
      setAppliedSearch('');

      const inferred = uniqueHierarchyFromImportedRows(imported);
      setFilters((prev) => ({
        ...prev,
        school: inferred.school,
        instructor: inferred.instructor,
        period: inferred.period,
        group: inferred.group,
      }));

      if (workspaceId && rawRows.length) {
        const payloadRows = rawRows.map((r) => ({
          capturedAt: r.capturedAt,
          sessionCode: r.sessionId || 'SESSION',
          sessionName: r.sessionName || 'Imported Session',
          sessionNotes: r.sessionNotes || '',
          location: r.location || '',
          school: r.school || '',
          instructor: r.instructor || '',
          period: r.period || '',
          group: r.group || '',
          indoorOutdoor: normalizeIndoorOutdoor(r.indoorOutdoor),
          latitude: Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : null,
          longitude: Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : null,
          pm25: Number(r.pm25) || 0,
          co: Number(r.co) || 0,
          temp: Number(r.temp) || 0,
          humidity: Number(r.humidity) || 0,
        }));
        try {
          for (let i = 0; i < payloadRows.length; i += CSV_UPLOAD_CHUNK_SIZE) {
            const chunk = payloadRows.slice(i, i + CSV_UPLOAD_CHUNK_SIZE);
            await importCsvMeasurements(workspaceId, chunk);
          }
          await loadFromBackend();
        } catch (persistError) {
          setImportError(
            persistError?.message
              ? `Imported locally, but cloud save failed: ${persistError.message}`
              : 'Imported locally, but cloud save failed.'
          );
        }
      }
    } catch (error) {
      setImportError(error.message || 'Failed to import CSV.');
    } finally {
      event.target.value = '';
    }
  };

  const handleClearImportedData = async () => {
    try {
      if (workspaceId) {
        await clearWorkspaceMeasurements(workspaceId);
      }
      clearImportedMeasurements();
      setRawData([]);
      onImportedDataChanged?.();
      setImportError('');
    } catch (error) {
      setImportError(error.message || 'Failed to clear data.');
    }
  };

  // TODO(backend): persist via a session visibility-update endpoint (e.g.
  // PATCH /workspaces/:id/sessions/:sessionId { visibility }) with SERVER-SIDE owner
  // authorization — only the session owner may change visibility. For now this updates
  // local mock state only; ownership is mocked as the dev user's own sessions.
  const handleVisibilityChange = (rowId, visibility) => {
    setRawData((prev) => prev.map((r) => (r.id === rowId ? { ...r, visibility } : r)));
    setVisibilityMenu(null);
  };

  const markEdited = (rowIds, field) => {
    setEditedCells(prev => {
      const updated = { ...prev };
      rowIds.forEach(id => {
        updated[id] = {
          ...(updated[id] || {}),
          [field]: true
        };
      });
      return updated;
    });
  };

  const handleSessionNotesEdit = (rowId, newNotes) => {
    const currentRow = rawData.find((r) => r.id === rowId);
    const changed = !currentRow || (currentRow.sessionNotes || '') !== (newNotes || '');
    if (changed) {
      setRawData(prev => prev.map(row =>
        row.id === rowId ? { ...row, sessionNotes: newNotes } : row
      ));
      markEdited([rowId], 'sessionNotes');
    }
    setEditingNotes(null);
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? 
      <TrendingUp className="w-4 h-4" /> : 
      <TrendingDown className="w-4 h-4" />;
  };

  const FIELD_FORMATTERS = {
    pm25: (value) => Math.max(0, parseInt(value || 0, 10)),
    temp: (value) => Math.round(value || 0),
    humidity: (value) => Math.min(100, Math.max(0, Math.round(value || 0))),
    co: (value) => parseFloat(value || 0).toFixed(2),
    indoorOutdoor: (value) => value
  };

  const handleFieldEdit = (rowId, field, value) => {
    const formatter = FIELD_FORMATTERS[field] || ((v) => v);
    const formattedValue = formatter(value);
    const currentRow = rawData.find((r) => r.id === rowId);
    const changed = !currentRow || String(currentRow[field]) !== String(formattedValue);

    // Only flag as edited / persist when the value actually changed from its current
    // value — a no-op edit (click a cell, blur without changing) must not show a marker.
    if (changed) {
      setRawData(prev =>
        prev.map(row =>
          row.id === rowId
            ? { ...row, [field]: formattedValue }
            : row
        )
      );

      markEdited([rowId], field);
      if (workspaceId && ['pm25', 'co', 'temp', 'humidity'].includes(field)) {
        addMeasurementEdit(workspaceId, rowId, {
          fieldName: field,
          editedValue: Number(formattedValue),
          editNote: 'Dashboard manual correction',
        }).catch(() => {
          // Keep UI responsive even if backend edit write fails.
        });
      }
    }

    setEditingCell({ rowId: null, field: null });
  };

  const isEdited = (rowId, field) => editedCells[rowId]?.[field];

  // Generate detailed second-by-second data for a row
  const generateDetailedData = (row) => {
    if (Array.isArray(row.detailedData) && row.detailedData.length > 0) {
      return row.detailedData;
    }
    const baseTime = new Date(`${row.date}T${row.time}`);
    if (Number.isNaN(baseTime.getTime())) {
      return [
        {
          id: `${row.id}-0`,
          time: String(row.time || '—'),
          pm25: row.pm25,
          co: row.co,
          temp: row.temp,
          humidity: row.humidity,
        },
      ];
    }
    const detailed = [];
    for (let i = 0; i < 60; i++) {
      const time = new Date(baseTime.getTime() + i * 1000);
      detailed.push({
        id: `${row.id}-${i}`,
        time: time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        pm25: row.pm25,
        co: row.co,
        temp: row.temp,
        humidity: row.humidity,
      });
    }
    return detailed;
  };

  const toggleRowExpansion = (rowId) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Raw Data</h1>
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 text-gray-500 text-sm font-bold leading-none hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="How to use Raw Data"
              aria-label="How to use Raw Data"
            >
              ?
            </button>

            {/* Display preferences (view-only, not data filters) */}
            <div className="relative">
              <button
                onClick={() => setShowDisplaySettings((s) => !s)}
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-colors ${
                  showDisplaySettings ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
                title="Display preferences"
                aria-label="Display preferences"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              {showDisplaySettings && (
                <div className="absolute left-0 z-30 mt-2 w-60 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Display preferences</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Temperature</span>
                    <div className="inline-flex rounded-md border border-gray-200 p-0.5">
                      {['C', 'F'].map((u) => (
                        <button
                          key={u}
                          onClick={() => setTempUnit(u)}
                          className={`px-2 py-0.5 text-xs rounded ${tempUnit === u ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          °{u}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Date format</span>
                    <div className="inline-flex rounded-md border border-gray-200 p-0.5">
                      {[{ k: 'ymd', l: 'yyyy-mm-dd' }, { k: 'mdy', l: 'mm-dd-yyyy' }].map((o) => (
                        <button
                          key={o.k}
                          onClick={() => setDateFormat(o.k)}
                          className={`px-2 py-0.5 text-xs rounded ${dateFormat === o.k ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-gray-600">
            Explore air quality data from your group, class, and school
          </p>
          {loadingBackend && <p className="text-xs text-gray-500 mt-1">Loading backend data...</p>}
          {importError && <p className="text-xs text-red-600 mt-1">{importError}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Read-only identity: your School · Class (teacher · period) · Group */}
          <div className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            {viewerIdentity.school} · {primaryMembership.instructor} · {primaryMembership.period} · {primaryMembership.group}
          </div>
          <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
          </label>
          <button
            onClick={() => setConfirmState({
              variant: 'danger',
              title: 'Clear all imported data?',
              message: 'This removes all imported data from this view.',
              confirmLabel: 'Clear data',
              onConfirm: handleClearImportedData,
            })}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-all"
          >
            Clear Data
          </button>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Export CSV
              <ChevronDown className="w-4 h-4" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-1">
                <button
                  onClick={handleDownloadCsv}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Download CSV
                </button>
                <button
                  onClick={handleSaveCsvAs}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Save CSV as…
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleShareCsv}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          </div>
        </div>
      </div>

      {/* Merged toolbar: scope tabs · search · filter chips · Apply / Clear */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {[
              { id: 'school', label: 'School' },
              { id: 'class', label: 'Class' },
              { id: 'group', label: 'Group' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setScopeTab(tab.id); setHasEngaged(true); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  scopeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scope selector (Group / Class) */}
          {scopeTab === 'group' && (
            <div className="flex items-center gap-2">
              <select
                value={scopeGroup}
                onChange={(e) => { setScopeGroup(e.target.value); setHasEngaged(true); }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {groupsForSelectedClass.map((g) => (
                  <option key={g} value={g}>{g === viewerGroupForClass(scopeClassKey) ? `${g} (My Group)` : g}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500 whitespace-nowrap">in {selectedClassLabel}</span>
            </div>
          )}
          {scopeTab === 'class' && (
            <select
              value={scopeClassKey}
              onChange={(e) => selectClassContext(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {classPeriods.map((c) => (
                <option key={c.key} value={c.key}>{viewerClassKeys.includes(c.key) ? `${c.label} (My Class)` : c.label}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="Search location, session, group..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date range chip → custom calendar */}
          <div className="relative">
            <button
              onClick={() => setOpenChip(openChip === 'date' ? null : 'date')}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                selectedDatesDraft.size > 0 ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {selectedDatesDraft.size > 0
                ? `${selectedDatesDraft.size} date${selectedDatesDraft.size > 1 ? 's' : ''}`
                : 'Date range'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {openChip === 'date' && (
              <div className="absolute right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                <DataCalendar
                  dataDates={dataDates}
                  selectedDates={selectedDatesDraft}
                  onChange={setSelectedDatesDraft}
                  initialMonthKey={[...dataDates].sort().slice(-1)[0]?.slice(0, 7)}
                />
                {selectedDatesDraft.size > 0 && (
                  <button
                    onClick={() => setSelectedDatesDraft(new Set())}
                    className="mt-2 w-full text-center text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metrics chip */}
          <div className="relative">
            <button
              onClick={() => setOpenChip(openChip === 'metrics' ? null : 'metrics')}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                METRIC_KEYS.some((m) => !metricsDraft[m.key]) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Metrics
              <ChevronDown className="w-4 h-4" />
            </button>
            {openChip === 'metrics' && (
              <div className="absolute right-0 z-20 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1">
                {METRIC_KEYS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={!!metricsDraft[m.key]}
                      onChange={(e) => setMetricsDraft((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Location chip */}
          <div className="relative">
            <button
              onClick={() => setOpenChip(openChip === 'location' ? null : 'location')}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                locationFilter !== 'all' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {locationFilter === 'all' ? 'Location' : locationFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {openChip === 'location' && (
              <div className="absolute right-0 z-20 mt-2 w-52 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-1">
                <button
                  onClick={() => { setLocationFilter('all'); setOpenChip(null); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm rounded-md ${locationFilter === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  All Locations
                </button>
                {locations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setLocationFilter(loc); setOpenChip(null); }}
                    className={`block w-full text-left px-3 py-1.5 text-sm rounded-md ${locationFilter === loc ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Apply / Clear */}
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
          >
            Apply
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all"
          >
            Clear filters
          </button>

          {scopeTab === 'school' && (
            <span className="text-sm text-gray-500 w-full md:w-auto">All sessions across {viewerIdentity.school}.</span>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <p className="text-gray-600">
          Showing <span className="font-semibold text-gray-900">{paginatedData.length}</span> of{' '}
          <span className="font-semibold text-gray-900">{viewRows.length}</span> sessions
        </p>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {viewRows.length === 0 && (
          <div className="px-6 py-16 text-center border-b border-gray-200">
            {!hasEngaged ? (
              <>
                <p className="text-lg font-semibold text-gray-800">Select a scope or filters to view sessions</p>
                <p className="text-sm text-gray-500 mt-2">
                  Pick a scope tab (Group / Class / School) or apply filters above to load sessions.
                </p>
              </>
            ) : rawData.length > 0 ? (
              <>
                <p className="text-lg font-semibold text-gray-800">No sessions match your filters</p>
                <p className="text-sm text-gray-500 mt-2">
                  Adjust your scope or filters, or use Clear filters.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-800">No data imported</p>
                <p className="text-sm text-gray-500 mt-2">
                  Import a CSV from your app export, or connect backend data.
                </p>
              </>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-12">
                </th>
                <th
                  onClick={() => handleSort('capturedAt')}
                  className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    Timestamp
                    <SortIcon columnKey="capturedAt" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSelectedMetric('pm25');
                    handleSort('pm25');
                  }}
                  className={`w-32 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${appliedMetrics.pm25 ? '' : 'hidden'} ${
                    selectedMetric === 'pm25' ? `${theme.bg} text-white hover:opacity-90` : 'text-gray-700'
                  }`}
                  title="Particulate matter 2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="leading-tight">PM 2.5 <span className="normal-case">(µg/m³)</span></span>
                    <SortIcon columnKey="pm25" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSelectedMetric('co');
                    handleSort('co');
                  }}
                  className={`w-32 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${appliedMetrics.co ? '' : 'hidden'} ${
                    selectedMetric === 'co' ? `${theme.bg} text-white hover:opacity-90` : 'text-gray-700'
                  }`}
                  title="Carbon monoxide"
                >
                  <div className="flex items-center gap-2">
                    <span className="leading-tight">CO <span className="normal-case">(ppm)</span></span>
                    <SortIcon columnKey="co" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSelectedMetric('temp');
                    handleSort('temp');
                  }}
                  className={`w-32 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${appliedMetrics.temp ? '' : 'hidden'} ${
                    selectedMetric === 'temp' ? `${theme.bg} text-white hover:opacity-90` : 'text-gray-700'
                  }`}
                  title="Temperature"
                >
                  <div className="flex items-center gap-2">
                    <span className="leading-tight">TEMP ({tempUnitLabel})</span>
                    <SortIcon columnKey="temp" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSelectedMetric('humidity');
                    handleSort('humidity');
                  }}
                  className={`w-32 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${appliedMetrics.humidity ? '' : 'hidden'} ${
                    selectedMetric === 'humidity' ? `${theme.bg} text-white hover:opacity-90` : 'text-gray-700'
                  }`}
                  title="Humidity"
                >
                  <div className="flex items-center gap-2">
                    <span className="leading-tight">HUM (%)</span>
                    <SortIcon columnKey="humidity" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Location
                    <SortIcon columnKey="location" />
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  INDOOR/OUTDOOR
                </th>
                <th
                  onClick={() => handleSort('latitude')}
                  className="w-px whitespace-nowrap px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  title="GPS Latitude"
                >
                  <div className="flex items-center gap-2">
                    GPS LAT
                    <SortIcon columnKey="latitude" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('longitude')}
                  className="w-px whitespace-nowrap px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  title="GPS Longitude"
                >
                  <div className="flex items-center gap-2">
                    GPS LONG
                    <SortIcon columnKey="longitude" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sessionName')}
                  className="w-64 px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Session Name
                    <SortIcon columnKey="sessionName" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('school')}
                  className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    School
                    <SortIcon columnKey="school" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('instructor')}
                  className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    Class (teacher · period)
                    <SortIcon columnKey="instructor" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('group')}
                  className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Group
                    <SortIcon columnKey="group" />
                  </div>
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Visibility
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((row, idx) => {
                const isExpanded = expandedRows[row.id];
                const detailedData = isExpanded ? generateDetailedData(row) : [];
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={(e) => {
                        // Whole-row toggles expansion, except when clicking an interactive
                        // element (chevron, editable cells, coordinate links, visibility pill/menu).
                        if (!e.target.closest('button, a, input, select, textarea')) {
                          toggleRowExpansion(row.id);
                        }
                      }}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRowExpansion(row.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title={isExpanded ? "Collapse" : "Expand to see detailed data"}
                        >
                          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-mono text-xs">
                        {formatTimestamp(row.capturedAt)}
                      </td>
                  {/* PM 2.5 */}
                  <td className={`px-4 py-3 text-sm font-semibold ${appliedMetrics.pm25 ? '' : 'hidden'} ${selectedMetric === 'pm25' ? 'bg-blue-50' : ''}`}>
                    {editingCell.rowId === row.id && editingCell.field === 'pm25' ? (
                      <input
                        type="number"
                        defaultValue={row.pm25}
                        autoFocus
                        min="0"
                        onBlur={(e) => handleFieldEdit(row.id, 'pm25', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldEdit(row.id, 'pm25', e.target.value);
                          if (e.key === 'Escape') setEditingCell({ rowId: null, field: null });
                        }}
                        className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, field: 'pm25' })}
                        className="flex items-center gap-1 text-left w-full"
                        title="Click to edit PM 2.5"
                      >
                        <span>{row.pm25}</span>
                        {isEdited(row.id, 'pm25') && (
                          <span className="text-xs text-orange-600 font-semibold">*</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* CO */}
                  <td className={`px-4 py-3 text-sm font-semibold ${appliedMetrics.co ? '' : 'hidden'} ${selectedMetric === 'co' ? 'bg-purple-50' : ''}`}>
                    {editingCell.rowId === row.id && editingCell.field === 'co' ? (
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={row.co}
                        autoFocus
                        min="0"
                        onBlur={(e) => handleFieldEdit(row.id, 'co', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldEdit(row.id, 'co', e.target.value);
                          if (e.key === 'Escape') setEditingCell({ rowId: null, field: null });
                        }}
                        className="w-20 px-2 py-1 text-sm border border-purple-500 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, field: 'co' })}
                        className="flex items-center gap-1 text-left w-full"
                        title="Click to edit CO"
                      >
                        <span>{row.co}</span>
                        {isEdited(row.id, 'co') && (
                          <span className="text-xs text-orange-600 font-semibold">*</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Temperature */}
                  <td className={`px-4 py-3 text-sm font-semibold ${appliedMetrics.temp ? '' : 'hidden'} ${selectedMetric === 'temp' ? 'bg-red-50' : ''}`}>
                    {editingCell.rowId === row.id && editingCell.field === 'temp' ? (
                      <input
                        type="number"
                        defaultValue={displayTemp(row.temp)}
                        autoFocus
                        onBlur={(e) => handleFieldEdit(row.id, 'temp', tempInputToC(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldEdit(row.id, 'temp', tempInputToC(e.target.value));
                          if (e.key === 'Escape') setEditingCell({ rowId: null, field: null });
                        }}
                        className="w-20 px-2 py-1 text-sm border border-red-500 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, field: 'temp' })}
                        className="flex items-center gap-1 text-left w-full"
                        title="Click to edit temperature"
                      >
                        <span>{displayTemp(row.temp)}</span>
                        {isEdited(row.id, 'temp') && (
                          <span className="text-xs text-orange-600 font-semibold">*</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Humidity */}
                  <td className={`px-4 py-3 text-sm font-semibold ${appliedMetrics.humidity ? '' : 'hidden'} ${selectedMetric === 'humidity' ? 'bg-green-50' : ''}`}>
                    {editingCell.rowId === row.id && editingCell.field === 'humidity' ? (
                      <input
                        type="number"
                        defaultValue={row.humidity}
                        autoFocus
                        min="0"
                        max="100"
                        onBlur={(e) => handleFieldEdit(row.id, 'humidity', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldEdit(row.id, 'humidity', e.target.value);
                          if (e.key === 'Escape') setEditingCell({ rowId: null, field: null });
                        }}
                        className="w-20 px-2 py-1 text-sm border border-green-500 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, field: 'humidity' })}
                        className="flex items-center gap-1 text-left w-full"
                        title="Click to edit humidity"
                      >
                        <span>{row.humidity}</span>
                        {isEdited(row.id, 'humidity') && (
                          <span className="text-xs text-orange-600 font-semibold">*</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-sm max-w-[220px]">
                    <span className="truncate block" title={String(row.location ?? '')}>{row.location || '—'}</span>
                  </td>

                  {/* INDOOR/OUTDOOR */}
                  <td className="px-4 py-3 text-sm">
                    {editingCell.rowId === row.id && editingCell.field === 'indoorOutdoor' ? (
                      <select
                        defaultValue={row.indoorOutdoor}
                        autoFocus
                        onChange={(e) => handleFieldEdit(row.id, 'indoorOutdoor', e.target.value)}
                        onBlur={(e) => handleFieldEdit(row.id, 'indoorOutdoor', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {INDOOR_OUTDOOR_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, field: 'indoorOutdoor' })}
                        className="flex items-center gap-2"
                        title="Click to edit INDOOR/OUTDOOR"
                      >
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          row.indoorOutdoor === 'INDOOR'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {row.indoorOutdoor}
                        </span>
                        {isEdited(row.id, 'indoorOutdoor') && (
                          <span className="text-xs text-orange-600 font-semibold">*</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Latitude */}
                  <td className="px-4 py-3 text-sm font-mono">
                    {row.latitude != null && row.longitude != null && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) ? (
                      <a
                        href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        title="Open in Google Maps"
                      >
                        {Number(row.latitude).toFixed(4)}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Longitude */}
                  <td className="px-4 py-3 text-sm font-mono">
                    {row.latitude != null && row.longitude != null && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) ? (
                      <a
                        href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        title="Open in Google Maps"
                      >
                        {Number(row.longitude).toFixed(4)}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Session Name */}
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">{row.sessionName}</span>
                  </td>

                  {/* School */}
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">{row.school}</span>
                  </td>

                  {/* Class (teacher · period) */}
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <span className="font-medium text-gray-900">{row.instructor} · {row.period}</span>
                  </td>

                  {/* Group */}
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">{row.group}</span>
                  </td>

                  {/* Visibility — editable by the session OWNER only */}
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {(() => {
                      const meta = VISIBILITY_META[row.visibility];
                      if (!meta) return <span className="text-gray-400">—</span>;
                      const isOwner = row.ownerCode === viewerIdentity.studentCode;
                      if (!isOwner) {
                        return (
                          <span className="group inline-flex items-center gap-1" title="Only the session owner can change this">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${meta.cls}`}>{meta.label}</span>
                            <Lock className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        );
                      }
                      return (
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => { e.stopPropagation(); setVisibilityMenu(visibilityMenu === row.id ? null : row.id); }}
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${meta.cls} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition`}
                            title="Change who can see this session"
                          >
                            {meta.label}
                          </button>
                          {visibilityMenu === row.id && (
                            <div
                              className="absolute right-0 z-30 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg p-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {VISIBILITY_OPTIONS.map((key) => (
                                <button
                                  key={key}
                                  onClick={(e) => { e.stopPropagation(); handleVisibilityChange(row.id, key); }}
                                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-gray-50 ${row.visibility === key ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${VISIBILITY_META[key].dot}`} />
                                  {VISIBILITY_META[key].label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan="15" className="px-4 py-4 bg-gray-50 border-t-2 border-gray-300">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Detailed Second-by-Second Data</h4>
                          <span className="text-xs text-gray-500">{detailedData.length} readings</span>
                        </div>
                        {/* Fixed-height (~10 rows) scrollable panel so long sessions don't
                            stretch the expansion — Session Photos below stay visible. */}
                        <div className="h-72 overflow-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-100 sticky top-0">
                              <tr>
                                <th className="px-2 py-2 text-left font-semibold">Time</th>
                                <th className="px-2 py-2 text-left font-semibold">PM 2.5 (µg/m³)</th>
                                <th className="px-2 py-2 text-left font-semibold">CO (ppm)</th>
                                <th className="px-2 py-2 text-left font-semibold">Temperature ({tempUnitLabel})</th>
                                <th className="px-2 py-2 text-left font-semibold">Humidity (%)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {detailedData.map((detail) => (
                                <tr key={detail.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-1 font-mono">{detail.time}</td>
                                  <td className="px-2 py-1">{detail.pm25}</td>
                                  <td className="px-2 py-1">{detail.co}</td>
                                  <td className="px-2 py-1">{displayTemp(detail.temp)}</td>
                                  <td className="px-2 py-1">{detail.humidity}</td>
                </tr>
              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Photo Gallery */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                            <h5 className="font-semibold text-gray-700 text-sm">Session Photos</h5>
                            {row.photos && row.photos.length > 0 && (
                              <span className="text-xs text-gray-500">({row.photos.length})</span>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {row.photos && row.photos.length > 0 ? (
                              row.photos.map((photo, photoIdx) => {
                                const photoTimestamp = photo.timestamp 
                                  ? new Date(photo.timestamp).toLocaleString('en-US', {
                                      dateStyle: 'short',
                                      timeStyle: 'medium'
                                    })
                                  : `${row.date} ${row.time}`;
                                return (
                                  <button
                                    key={photoIdx}
                                    onClick={() => setSelectedPhoto({ ...photo, rowDate: row.date, rowTime: row.time, location: row.location })}
                                    className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors group"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={`Capture ${photoIdx + 1}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23ddd" width="80" height="80"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10"%3EImage%3C/text%3E%3C/svg%3E';
                                      }}
                                    />
                                    {/* Timestamp overlay on photo */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-[8px] px-1 py-0.5 font-mono">
                                      {photoTimestamp}
                                    </div>
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                                      <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                No photos
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Observation note (per-session), below Session Photos */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="font-semibold text-gray-700 text-sm mb-2">Observation note</h5>
                          {editingNotes === row.id ? (
                            <textarea
                              defaultValue={row.sessionNotes}
                              autoFocus
                              rows="2"
                              onBlur={(e) => handleSessionNotesEdit(row.id, e.target.value)}
                              placeholder="Add an observation note about this session..."
                              className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingNotes(row.id)}
                              className="text-left w-full text-sm text-gray-600 hover:text-blue-600 transition-colors group"
                              title="Click to add or edit the observation note"
                            >
                              {row.sessionNotes ? (
                                <span className="inline-flex items-center gap-2">
                                  <span>{row.sessionNotes}</span>
                                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                                  {isEdited(row.id, 'sessionNotes') && (
                                    <span className="text-xs text-orange-600 font-semibold">*</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Add an observation note…</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Session Photo</h3>
                <p className="text-sm text-gray-600">{selectedPhoto.location} - {selectedPhoto.rowDate} {selectedPhoto.rowTime}</p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="relative">
                <img
                  src={selectedPhoto.url}
                  alt="Enlarged capture"
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg mb-4"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
                  }}
                />
                {/* Timestamp overlay on photo */}
                {selectedPhoto.timestamp && (
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-sm px-3 py-2 rounded font-mono">
                    {new Date(selectedPhoto.timestamp).toLocaleString('en-US', {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                    })}
                  </div>
                )}
              </div>
              <div className="w-full bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Photo Information</p>
                    <p className="text-sm text-gray-600">
                      {selectedPhoto.timestamp 
                        ? new Date(selectedPhoto.timestamp).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'medium'
                          })
                        : `${selectedPhoto.rowDate} ${selectedPhoto.rowTime}`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const timestamp = selectedPhoto.timestamp 
                        ? new Date(selectedPhoto.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, -5)
                        : `${selectedPhoto.rowDate}-${selectedPhoto.rowTime.replace(':', '-')}`;
                      const link = document.createElement('a');
                      link.href = selectedPhoto.url;
                      link.download = `air-quality-${timestamp}.jpg`;
                      link.target = '_blank';
                      link.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowHelpModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">How to Use Raw Data</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📊 Viewing Data</h4>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>• Click the <strong>chevron (▶)</strong> to expand rows and see detailed second-by-second sensor data</li>
                  <li>• Click <strong>location coordinates</strong> to open Google Maps</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">✏️ Editing Data</h4>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>• <strong>Click any data value</strong> to edit it - edited values show a <span className="font-bold text-orange-600">*</span> badge</li>
                  <li>• <strong>Click notes</strong> to add context about measurement conditions</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📷 Photos</h4>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>• <strong>Click photos</strong> in expanded rows to view full-size images</li>
                  <li>• Photos show timestamps automatically</li>
                  <li>• Use the <strong>Download button</strong> to save photos with timestamp filenames</li>
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmState}
        variant={confirmState?.variant}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          confirmState?.onConfirm?.();
          setConfirmState(null);
        }}
      />
    </div>
  );
};

export default RawDataView;