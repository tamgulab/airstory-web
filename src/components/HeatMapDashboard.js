import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, Info, Layers3, LocateFixed, Share2, Star } from 'lucide-react';
import MapView, {
  FullscreenControl, Layer, Marker, NavigationControl, Popup, Source,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import html2canvas from 'html2canvas';
import { getImportedMeasurements, isBlankHierarchyField } from '../utils/importedData';
import { getSchools } from '../api/schools';
import { apiRequest } from '../api/http';
import { AQI_RANGES, getColorForValue, getStatusLabel } from '../utils/airQuality';
import { buildTeamTrailSegments, preferPointsNearSchool } from '../utils/trails';
import { resolveDirectorySchool, schoolLabelsMatch, shortLabelFromSchoolName } from '../utils/schoolLabels';

const MAP_STYLE_URL =
  process.env.REACT_APP_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Pre-registered preset cities with real OpenAQ coverage, so anyone can preview the heat map. */
const PRESET_CITIES = Object.freeze([
  { id: 'philadelphia', label: 'Philadelphia', city: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652, radius: 15000 },
  { id: 'newyork', label: 'New York', city: 'New York, NY', lat: 40.7128, lng: -74.006, radius: 15000 },
  { id: 'hanoi', label: 'Hanoi', city: 'Hanoi, Vietnam', lat: 21.0278, lng: 105.8342, radius: 15000 },
]);

/** Distinct, colorblind-considerate palette used for group / class / school trail coloring. */
const TRAIL_COLOR_PALETTE = [
  '#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706',
  '#0891B2', '#DB2777', '#65A30D', '#4F46E5', '#EA580C',
];

function colorForKey(key, keyOrder) {
  const idx = keyOrder.indexOf(key);
  return TRAIL_COLOR_PALETTE[(idx < 0 ? 0 : idx) % TRAIL_COLOR_PALETTE.length];
}

// Air quality gradient (Transparent -> Green -> Yellow -> Orange -> Red -> Purple -> Maroon)
const heatmapGradient = [
  'rgba(0, 255, 255, 0)',
  'rgba(0, 228, 0, 1)',
  'rgba(255, 255, 0, 1)',
  'rgba(255, 126, 0, 1)',
  'rgba(255, 0, 0, 1)',
  'rgba(153, 0, 76, 1)',
  'rgba(126, 0, 35, 1)'
];

// Color-vision accessible palette (Viridis reversed): Good → yellow, Very Unhealthy → purple
const accessibleGradient = [
  'rgba(0, 255, 255, 0)',
  'rgba(255, 255, 255, 1)',
  'rgba(253, 231, 37, 1)',
  'rgba(94, 201, 98, 1)',
  'rgba(33, 145, 140, 1)',
  'rgba(59, 82, 139, 1)',
  'rgba(68, 1, 84, 1)'
];

/** Built-in campus view — tight enough to read the school block, not the whole borough. */
const SCHOOL_FOCUS_ZOOM = 16;
const DEFAULT_MAP_ZOOM = 15;
/** World overview max zoom when fitting every school that has raw-data pins. */
const WORLD_FIT_MAX_ZOOM = 4;

/** Prefer CSV school codes (e.g. BXS) on the pin when that is what raw data uses. */
function pinShortLabel(dataLabel, displayName) {
  const code = String(dataLabel || '').trim();
  if (code && code.length <= 6 && /^[A-Za-z0-9]+$/.test(code)) return code.toUpperCase();
  return shortLabelFromSchoolName(displayName || dataLabel);
}

const StatusInfoModal = ({ isOpen, onClose, theme }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`${theme.bg} text-white p-6 rounded-t-2xl`}>
          <h3 className="text-xl font-bold">Air Quality Index (AQI) Criteria</h3>
          <p className="text-sm opacity-90 mt-1">Understanding air quality status levels for PM 2.5</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {AQI_RANGES.pm25.slice(0, -1).map((range, idx) => {
              const prevMax = idx > 0 ? AQI_RANGES.pm25[idx - 1].max : 0;
              return (
                <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200">
                  <div 
                    className="w-12 h-12 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: range.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{range.label}</h4>
                      <span className="text-sm font-semibold text-gray-600">
                        {prevMax + 1} - {range.max} µg/m³
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {idx === 0 && "Air quality is satisfactory, and air pollution poses little or no risk."}
                      {idx === 1 && "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution."}
                      {idx === 2 && "Members of sensitive groups may experience health effects. The general public is less likely to be affected."}
                      {idx === 3 && "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects."}
                      {idx === 4 && "Health alert: The risk of health effects is increased for everyone."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Source Attribution */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              <strong>Source:</strong> U.S. Environmental Protection Agency (EPA). 
              <a href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline ml-1">
                AirNow - Air Quality Index Basics
              </a>
            </p>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className={`w-full py-3 ${theme.bg} ${theme.hover} text-white font-semibold rounded-lg transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const HeatMapDashboard = ({
  workspaceKind = 'class', // 'class' | 'school' | 'public' — workspace context from App
  schoolId = null,
  selectedMetric,
  setSelectedMetric,
  filters,
  theme,
  metricThemes,
  importedDataVersion,
  onOpenRawData,
}) => {
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [selectedTimeRange] = useState('all-time');
  const [displayMode, setDisplayMode] = useState('default'); // 'default' or 'accessible'
  // Trail compare scope: Group/Class/School show trails for a focused school; World is overview pins only.
  const [trailScope, setTrailScope] = useState('class'); // 'group' | 'class' | 'school' | 'world'
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(PRESET_CITIES[0].id);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState('');
  const [schoolPinOpen, setSchoolPinOpen] = useState(false);
  // Focused school id — set ONLY by pin click, prev/next, or "your school" control.
  // Scope tabs (Group/Class/School/World) must not invent a selection.
  const [schoolNavId, setSchoolNavId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [schoolDirectory, setSchoolDirectory] = useState([]);
  const screenshotRef = useRef(null);
  const mapInstanceRef = useRef(null);
  /** Skip the auto fitBounds effect after an explicit pin / prev-next / World navigation. */
  const suppressAutoFitRef = useRef(false);
  const [openaqHeatmap, setOpenaqHeatmap] = useState(null);
  const [openaqStatus, setOpenaqStatus] = useState('idle');
  const importedMeasurements = useMemo(
    () => getImportedMeasurements(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importedDataVersion]
  );

  const selectedCity = useMemo(
    () => PRESET_CITIES.find((c) => c.id === selectedCityId) || PRESET_CITIES[0],
    [selectedCityId]
  );

  // The school directory now carries map coordinates (see backend migration 008); resolve the
  // current class's assigned school (My Page) to a pin, so changing it there moves the pin here.
  useEffect(() => {
    let cancelled = false;
    getSchools()
      .then((data) => {
        if (!cancelled) setSchoolDirectory(data.schools || []);
      })
      .catch(() => {
        if (!cancelled) setSchoolDirectory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * School pins come only from geotagged Raw Data — not the full directory.
   * Prefer directory coords when the measurement school label matches; otherwise use the
   * centroid of that school's geotagged samples so unlisted schools still appear.
   */
  const mappableSchools = useMemo(() => {
    const geotagged = importedMeasurements
      .map((row) => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const label = String(row.school ?? '').trim();
        if (!label) return null;
        return { label, lat, lng };
      })
      .filter(Boolean);

    const byLabel = new Map();
    geotagged.forEach((point) => {
      if (!byLabel.has(point.label)) byLabel.set(point.label, []);
      byLabel.get(point.label).push(point);
    });

    const pins = [];
    byLabel.forEach((points, label) => {
      const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      // Name/code match, then GPS centroid — so CVA near Hanoi resolves to Chu Văn An,
      // not a false-positive like Central High School in Philadelphia.
      const directoryMatch = resolveDirectorySchool({
        label,
        latitude: lat,
        longitude: lng,
        directory: schoolDirectory,
      });
      if (
        directoryMatch &&
        Number.isFinite(Number(directoryMatch.latitude)) &&
        Number.isFinite(Number(directoryMatch.longitude))
      ) {
        pins.push({
          id: directoryMatch.id || `data:${label}`,
          name: directoryMatch.name,
          dataLabel: label,
          shortLabel: pinShortLabel(label, directoryMatch.name),
          address: directoryMatch.name,
          lat: Number(directoryMatch.latitude),
          lng: Number(directoryMatch.longitude),
        });
        return;
      }
      pins.push({
        id: `data:${label}`,
        name: label,
        dataLabel: label,
        shortLabel: pinShortLabel(label, label),
        address: label,
        lat,
        lng,
      });
    });

    return pins.sort((a, b) => a.name.localeCompare(b.name));
  }, [importedMeasurements, schoolDirectory]);

  /** Class workspace's assigned school pin (My Page / membership), if it has coordinates. */
  const classSchoolPin = useMemo(() => {
    const match = schoolDirectory.find((school) =>
      schoolId ? school.id === schoolId : school.name === filters.school
    );
    if (match && Number.isFinite(Number(match.latitude)) && Number.isFinite(Number(match.longitude))) {
      return {
        id: match.id,
        name: match.name,
        dataLabel: match.name,
        shortLabel: shortLabelFromSchoolName(match.name),
        address: match.name,
        lat: Number(match.latitude),
        lng: Number(match.longitude),
      };
    }
    // Fall back to a data pin that soft-matches the profile school name / code (e.g. BXS).
    return (
      mappableSchools.find(
        (school) =>
          (schoolId && school.id === schoolId) ||
          schoolLabelsMatch(school.name, filters.school) ||
          schoolLabelsMatch(school.dataLabel, filters.school)
      ) || null
    );
  }, [schoolDirectory, schoolId, filters.school, mappableSchools]);

  const browsingWorld = trailScope === 'world';
  /** True only after the user picks a campus (pin / prev-next / home). */
  const hasSchoolSelection = Boolean(schoolNavId);

  /** Pin used for focus / trail proximity — null until a school is explicitly chosen. */
  const activeSchoolPin = useMemo(() => {
    if (!schoolNavId) return null;
    const fromData = mappableSchools.find((school) => school.id === schoolNavId);
    if (fromData) return fromData;
    if (classSchoolPin && classSchoolPin.id === schoolNavId) return classSchoolPin;
    return null;
  }, [schoolNavId, mappableSchools, classSchoolPin]);

  const focusedSchoolIndex = useMemo(() => {
    if (!activeSchoolPin) return -1;
    return mappableSchools.findIndex((school) => school.id === activeSchoolPin.id);
  }, [mappableSchools, activeSchoolPin]);

  const isHomeSchool = useCallback(
    (school) => {
      if (!classSchoolPin || !school) return false;
      return (
        school.id === classSchoolPin.id ||
        schoolLabelsMatch(school.name, classSchoolPin.name) ||
        schoolLabelsMatch(school.dataLabel, classSchoolPin.name)
      );
    },
    [classSchoolPin]
  );
  // Start each class in the reference city nearest its assigned school. Teachers can still switch
  // cities manually afterward; this only reruns when the class-school assignment changes.
  useEffect(() => {
    const anchor = classSchoolPin || mappableSchools[0];
    if (!anchor) return;
    const nearestCity = PRESET_CITIES.reduce((nearest, city) => {
      const distance = ((city.lat - anchor.lat) ** 2) + ((city.lng - anchor.lng) ** 2);
      const nearestDistance =
        ((nearest.lat - anchor.lat) ** 2) + ((nearest.lng - anchor.lng) ** 2);
      return distance < nearestDistance ? city : nearest;
    }, PRESET_CITIES[0]);
    setSelectedCityId(nearestCity.id);
  }, [classSchoolPin, mappableSchools]);

  useEffect(() => {
    if (!showHeatmap) {
      setOpenaqStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setOpenaqHeatmap(null);
    setOpenaqStatus('loading');
    (async () => {
      try {
        const q = new URLSearchParams({
          lat: String(selectedCity.lat),
          lng: String(selectedCity.lng),
          metric: selectedMetric,
          radius: String(selectedCity.radius),
          limit: '25',
        });
        const data = await apiRequest(`/analytics/openaq/heatmap?${q.toString()}`);
        if (cancelled) return;
        setOpenaqHeatmap({
          points: data.points || [],
          source: data.source || 'openaq',
        });
        setOpenaqStatus(data.points?.length ? 'success' : 'error');
      } catch {
        if (cancelled) return;
        setOpenaqHeatmap(null);
        setOpenaqStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showHeatmap, selectedMetric, selectedCity]);

  // Soft hierarchy: blank either side passes. School name is NOT hard-filtered —
  // CSV school codes vs My Page directory names were emptying Heat Map while Raw Data /
  // Analysis (which skip school-name match) still showed rows after refresh.
  const softEq = useCallback((filterVal, rowVal) => {
    if (isBlankHierarchyField(filterVal) || isBlankHierarchyField(rowVal)) return true;
    return String(filterVal) === String(rowVal);
  }, []);

  const rowToMapPoint = useCallback((row) => {
    const ts = row.capturedAt
      ? new Date(row.capturedAt)
      : new Date(`${row.date || '1970-01-01'}T${row.time || '00:00'}`);
    return {
      id: row.id,
      name: row.location || 'Imported Location',
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      pm25: Number(row.pm25) || 0,
      co: Number(row.co) || 0,
      temp: Number(row.temp) || 0,
      humidity: Number(row.humidity) || 0,
      timestamp: ts,
      school: row.school || '',
      instructor: row.instructor || '',
      period: row.period || '',
      group: row.group || '',
      sessionId: row.sessionId || '',
      date: row.date || '',
    };
  }, []);

  const isGeotaggedPoint = useCallback(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !Number.isNaN(p.timestamp.getTime()),
    []
  );

  const importedPoints = useMemo(() => {
    // Heatmap / date-range chips should include every geotagged CSV row (e.g. Vietnam + NYC).
    // Class hierarchy filters belong on trails, not the city heatmap layer.
    return importedMeasurements.map(rowToMapPoint).filter(isGeotaggedPoint);
  }, [importedMeasurements, rowToMapPoint, isGeotaggedPoint]);

  // Trails always come from Raw Data geotagged rows. Scope matches Raw Data tabs:
  // Group / Class / School show trails only after a school is explicitly selected;
  // World (and unscoped Group/Class/School) is overview pins only.
  const trailScopedPoints = useMemo(() => {
    if (trailScope === 'world' || !hasSchoolSelection || !activeSchoolPin) return [];

    const toTrailPoint = (row) => {
      const base = rowToMapPoint(row);
      return {
        lat: base.lat,
        lng: base.lng,
        timestamp: base.timestamp,
        sessionId: base.sessionId,
        date: base.date,
        school: base.school || 'Unknown school',
        instructor: base.instructor,
        period: base.period,
        group: base.group || 'Group',
      };
    };

    const matchesFocusedSchool = (row) => {
      const rowSchool = String(row.school ?? '').trim();
      if (!rowSchool) return true;
      return (
        schoolLabelsMatch(rowSchool, activeSchoolPin.dataLabel) ||
        schoolLabelsMatch(rowSchool, activeSchoolPin.name)
      );
    };

    const matchesScope = (row) => {
      if (!matchesFocusedSchool(row)) return false;
      if (workspaceKind === 'public') return true;
      if (trailScope === 'school') return true;
      if (!softEq(filters.instructor, row.instructor)) return false;
      if (!softEq(filters.period, row.period)) return false;
      if (trailScope === 'group' && !softEq(filters.group, row.group)) return false;
      return true;
    };

    return importedMeasurements.filter(matchesScope).map(toTrailPoint).filter(isGeotaggedPoint);
  }, [
    importedMeasurements,
    filters.instructor,
    filters.period,
    filters.group,
    trailScope,
    workspaceKind,
    softEq,
    rowToMapPoint,
    isGeotaggedPoint,
    activeSchoolPin,
    hasSchoolSelection,
  ]);

  // Soft near-school bias when focused; never fall back to distant campuses.
  const trailPointsForMap = useMemo(
    () =>
      preferPointsNearSchool(
        trailScopedPoints,
        hasSchoolSelection ? activeSchoolPin : null,
        undefined,
        { fallbackToAll: false }
      ),
    [trailScopedPoints, hasSchoolSelection, activeSchoolPin]
  );

  /**
   * Walk segments + static GPS markers per group. Hidden until a school is selected.
   */
  const { trailPaths, trailMarkers } = useMemo(() => {
    if (trailScope === 'world' || !hasSchoolSelection) return { trailPaths: [], trailMarkers: [] };
    const { segments, markers, colorKeyOrder } = buildTeamTrailSegments(trailPointsForMap, {
      trailScope,
    });
    return {
      trailPaths: segments.map((segment) => ({
        ...segment,
        color: colorForKey(segment.colorKey, colorKeyOrder),
      })),
      trailMarkers: markers.map((marker) => ({
        ...marker,
        color: colorForKey(marker.colorKey, colorKeyOrder),
      })),
    };
  }, [trailPointsForMap, trailScope, hasSchoolSelection]);

  const trailLegendItems = useMemo(() => {
    if (trailScope === 'world' || !hasSchoolSelection) return [];
    const seen = new Map();
    [...trailPaths, ...trailMarkers].forEach((t) => {
      if (!seen.has(t.colorKey)) seen.set(t.colorKey, { label: t.label, color: t.color });
    });
    return [...seen.values()];
  }, [trailPaths, trailMarkers, trailScope, hasSchoolSelection]);

  // Filter imported locations based on selected time range
  const filteredLocations = useMemo(() => {
    if (!importedPoints.length) return [];
    const now = new Date();
    let cutoffDate = new Date(0); // Default to beginning of time
    
    switch(selectedTimeRange) {
      case 'most-recent':
        // Show only the most recent data point for each location
        const locationGroups = {};
        importedPoints.forEach(point => {
          const key = point.name;
          if (!locationGroups[key] || point.timestamp > locationGroups[key].timestamp) {
            locationGroups[key] = point;
          }
        });
        return Object.values(locationGroups);
        
      case 'past-week':
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
        
      case 'past-month':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
        
      case 'past-3-months':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
        
      case 'all-time':
        cutoffDate = new Date(0);
        break;
        
      default:
        cutoffDate = new Date(0);
    }
    
    return importedPoints.filter(point => point.timestamp >= cutoffDate);
  }, [selectedTimeRange, importedPoints]);

  // Calculate date range label
  const dateRangeLabel = useMemo(() => {
    if (filteredLocations.length === 0) return 'No data';
    const dates = filteredLocations.map(loc => new Date(loc.timestamp));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    const formatDate = (date) => {
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };
    
    if (formatDate(minDate) === formatDate(maxDate)) {
      return formatDate(minDate);
    }
    return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
  }, [filteredLocations]);

  const usingOpenAQHeatmap = Boolean(openaqHeatmap?.points?.length);
  const usingClassHeatmap = filteredLocations.length > 0;

  // Heatmap = OpenAQ/WAQI city reference + geotagged Raw Data (CSV / class uploads).
  const locations = useMemo(() => {
    const openaq = (openaqHeatmap?.points || []).map((point, index) => {
      const value = Number(point.value);
      const row = {
        id: `openaq-${index}`,
        name: point.location_name || `${openaqHeatmap?.source === 'waqi' ? 'WAQI' : 'OpenAQ'} Site ${index + 1}`,
        lat: Number(point.latitude),
        lng: Number(point.longitude),
        pm25: 0,
        co: 0,
        temp: 0,
        humidity: 0,
        source: 'reference',
      };
      row[selectedMetric] = Number.isFinite(value) ? value : 0;
      return row;
    });
    const fromClass = filteredLocations.map((point, index) => ({
      id: point.id || `imported-heat-${index}`,
      name: point.name || point.school || 'Class measurement',
      lat: point.lat,
      lng: point.lng,
      pm25: point.pm25,
      co: point.co,
      temp: point.temp,
      humidity: point.humidity,
      source: 'class',
    }));
    return [...openaq, ...fromClass];
  }, [openaqHeatmap, selectedMetric, filteredLocations]);

  // Calculate Averages for Sidebar
  const filteredImported = useMemo(() => {
    if (!importedMeasurements.length) return [];
    const now = new Date();
    let cutoffDate = new Date(0);
    if (selectedTimeRange === 'past-week') {
      cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (selectedTimeRange === 'past-month') {
      cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    } else if (selectedTimeRange === 'past-3-months') {
      cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    }
    return importedMeasurements.filter((row) => {
      const captured = new Date(`${row.date}T${row.time || '00:00'}`);
      return captured >= cutoffDate;
    });
  }, [importedMeasurements, selectedTimeRange]);

  const stats = useMemo(() => {
    const metric = selectedMetric;
    const softEq = (filterVal, rowVal) => {
      if (!filterVal || !rowVal) return true;
      return String(filterVal) === String(rowVal);
    };

    const cityAvg = showHeatmap && locations.length
      ? Math.round(
        locations.reduce((sum, loc) => sum + parseFloat(loc[metric] ?? 0), 0) / locations.length
      )
      : null;

    // School/group cards should always come from your class CSV/workspace records, never OpenAQ city feed.
    const sourceForSchoolAndGroup = filteredImported;

    // School / group cards: skip hard school-name match (CSV codes vs directory names).
    // Fall back to the full imported pool when profile filters match nothing.
    const schoolData = sourceForSchoolAndGroup.filter((item) => softEq(filters.school, item.school));
    const schoolPool = schoolData.length ? schoolData : sourceForSchoolAndGroup;
    const schoolAvg = schoolPool.length > 0
      ? Math.round(schoolPool.reduce((sum, item) => sum + parseFloat(item[metric]), 0) / schoolPool.length)
      : null;

    // Group Average — when Group isn't set (common for teachers), average all groups in the
    // current instructor / period focus instead of showing a blank dash.
    const groupData = sourceForSchoolAndGroup.filter((item) => {
      if (!softEq(filters.instructor, item.instructor)) return false;
      if (!softEq(filters.period, item.period)) return false;
      if (filters.group && !softEq(filters.group, item.group)) return false;
      return true;
    });
    const groupPool = groupData.length ? groupData : sourceForSchoolAndGroup;
    const groupAvg = groupPool.length > 0
      ? Math.round(groupPool.reduce((sum, item) => sum + parseFloat(item[metric]), 0) / groupPool.length)
      : null;

    return { city: cityAvg, school: schoolAvg, group: groupAvg };
  }, [
    filteredImported,
    selectedMetric,
    filters,
    locations,
    showHeatmap,
  ]);

  const bestLocation = showHeatmap && locations.length
    ? locations.reduce((best, loc) => (loc[selectedMetric] < best[selectedMetric] ? loc : best))
    : null;

  const worstLocation = showHeatmap && locations.length
    ? locations.reduce((worst, loc) => (loc[selectedMetric] > worst[selectedMetric] ? loc : worst))
    : null;

  const mapCenter = useMemo(() => {
    if (showHeatmap) {
      return { lat: selectedCity.lat, lng: selectedCity.lng };
    }
    const trailPoints = [
      ...trailPaths.flatMap((trail) => trail.path),
      ...trailMarkers.map((marker) => ({ lat: marker.lat, lng: marker.lng })),
    ];
    if (trailPoints.length) {
      const lat = trailPoints.reduce((sum, point) => sum + Number(point.lat), 0) / trailPoints.length;
      const lng = trailPoints.reduce((sum, point) => sum + Number(point.lng), 0) / trailPoints.length;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (activeSchoolPin) return { lat: activeSchoolPin.lat, lng: activeSchoolPin.lng };
    return { lat: selectedCity.lat, lng: selectedCity.lng };
  }, [showHeatmap, selectedCity, trailPaths, trailMarkers, activeSchoolPin]);

  const heatmapData = useMemo(() => ({
    type: 'FeatureCollection',
    features: locations.map((location) => ({
      type: 'Feature',
      properties: { weight: Number(location[selectedMetric]) || 0 },
      geometry: {
        type: 'Point',
        coordinates: [Number(location.lng), Number(location.lat)],
      },
    })),
  }), [locations, selectedMetric]);

  const trailData = useMemo(() => ({
    type: 'FeatureCollection',
    features: trailPaths.map((trail) => ({
      type: 'Feature',
      properties: { color: trail.color, label: trail.label },
      geometry: {
        type: 'LineString',
        coordinates: trail.path.map((point) => [point.lng, point.lat]),
      },
    })),
  }), [trailPaths]);

  // Only static single-fix sessions use dots; day trails are lines (vertices stay on the polyline).
  const trailMarkerData = useMemo(() => ({
    type: 'FeatureCollection',
    features: trailMarkers.map((marker) => ({
      type: 'Feature',
      properties: { color: marker.color, label: marker.label },
      geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
    })),
  }), [trailMarkers]);

  const heatmapLayer = useMemo(() => {
    const gradient = displayMode === 'accessible' ? accessibleGradient : heatmapGradient;
    const maxWeight = Math.max(
      1,
      ...locations.map((location) => Number(location[selectedMetric]) || 0)
    );
    return {
      id: 'air-quality-heat',
      type: 'heatmap',
      maxzoom: 18,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, maxWeight, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 14, 1.4],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 14, 42],
        'heatmap-opacity': 0.72,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, gradient[0],
          0.18, gradient[1],
          0.36, gradient[2],
          0.54, gradient[3],
          0.72, gradient[4],
          0.88, gradient[5],
          1, gradient[6],
        ],
      },
    };
  }, [displayMode, locations, selectedMetric]);

  const trailLayer = useMemo(() => ({
    id: 'measurement-trails',
    type: 'line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 4,
      'line-opacity': 0.95,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  }), []);

  const trailMarkerLayer = useMemo(() => ({
    id: 'measurement-trail-points',
    type: 'circle',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 5,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  }), []);

  const fitAllSchools = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || mappableSchools.length === 0) return;
    if (mappableSchools.length === 1) {
      map.flyTo?.({
        center: [mappableSchools[0].lng, mappableSchools[0].lat],
        zoom: SCHOOL_FOCUS_ZOOM,
        duration: 900,
      });
      return;
    }
    const lngs = mappableSchools.map((s) => s.lng);
    const lats = mappableSchools.map((s) => s.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const padLng = Math.max((maxLng - minLng) * 0.15, 0.5);
    const padLat = Math.max((maxLat - minLat) * 0.15, 0.5);
    if (typeof map.fitBounds === 'function') {
      map.fitBounds(
        [
          [minLng - padLng, minLat - padLat],
          [maxLng + padLng, maxLat + padLat],
        ],
        { padding: 56, duration: 900, maxZoom: WORLD_FIT_MAX_ZOOM }
      );
    }
  }, [mappableSchools]);

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    if (suppressAutoFitRef.current) {
      suppressAutoFitRef.current = false;
      return;
    }
    const map = mapInstanceRef.current;
    // Heatmap on: frame OpenAQ + class CSV points together (e.g. NYC reference + Vietnam upload).
    if (showHeatmap && locations.length > 0 && typeof map.fitBounds === 'function') {
      const lngs = locations.map((loc) => Number(loc.lng)).filter(Number.isFinite);
      const lats = locations.map((loc) => Number(loc.lat)).filter(Number.isFinite);
      if (lngs.length && lats.length) {
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const span = Math.max(maxLng - minLng, maxLat - minLat);
        const padLng = Math.max((maxLng - minLng) * 0.2, span > 5 ? 2 : 0.02);
        const padLat = Math.max((maxLat - minLat) * 0.2, span > 5 ? 2 : 0.02);
        map.fitBounds(
          [
            [minLng - padLng, minLat - padLat],
            [maxLng + padLng, maxLat + padLat],
          ],
          { padding: 56, duration: 800, maxZoom: span > 5 ? 4 : 12 }
        );
        return;
      }
    }
    if (browsingWorld || !hasSchoolSelection) {
      fitAllSchools();
      return;
    }
    if (activeSchoolPin && !showHeatmap) {
      map.flyTo?.({
        center: [activeSchoolPin.lng, activeSchoolPin.lat],
        zoom: SCHOOL_FOCUS_ZOOM,
        duration: 700,
      });
      return;
    }
    const coords = [
      ...trailPaths.flatMap((trail) => trail.path.map((point) => [point.lng, point.lat])),
      ...trailMarkers.map((marker) => [marker.lng, marker.lat]),
    ];
    if (!showHeatmap && coords.length >= 2) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const padLng = Math.max((maxLng - minLng) * 0.2, 0.0015);
      const padLat = Math.max((maxLat - minLat) * 0.2, 0.0015);
      if (typeof map.fitBounds === 'function') {
        map.fitBounds(
          [
            [minLng - padLng, minLat - padLat],
            [maxLng + padLng, maxLat + padLat],
          ],
          { padding: 48, duration: 700, maxZoom: 17 }
        );
      }
      return;
    }
    if (!showHeatmap && coords.length === 1) {
      map.flyTo?.({ center: coords[0], zoom: SCHOOL_FOCUS_ZOOM, duration: 700 });
      return;
    }
    map.flyTo?.({
      center: [mapCenter.lng, mapCenter.lat],
      zoom: showHeatmap ? 12 : DEFAULT_MAP_ZOOM,
      duration: 700,
    });
  }, [
    isLoaded,
    showHeatmap,
    mapCenter.lat,
    mapCenter.lng,
    trailPaths,
    trailMarkers,
    activeSchoolPin,
    browsingWorld,
    hasSchoolSelection,
    fitAllSchools,
    locations,
  ]);

  const selectMapScope = useCallback(
    (scopeId) => {
      if (scopeId === 'world') {
        suppressAutoFitRef.current = true;
        setTrailScope('world');
        setSchoolNavId(null);
        setSchoolPinOpen(false);
        requestAnimationFrame(() => fitAllSchools());
        return;
      }
      // Group / Class / School: change compare mode only. Do not invent a school selection.
      setTrailScope(scopeId);
      if (!schoolNavId) {
        setSchoolPinOpen(false);
        suppressAutoFitRef.current = true;
        requestAnimationFrame(() => fitAllSchools());
      }
    },
    [fitAllSchools, schoolNavId]
  );

  const selectSchoolPin = useCallback((school) => {
    if (!school) return;
    suppressAutoFitRef.current = true;
    setTrailScope((prev) => (prev === 'world' ? 'school' : prev));
    setSchoolNavId(school.id);
    setSchoolPinOpen(true);
    mapInstanceRef.current?.flyTo({
      center: [school.lng, school.lat],
      zoom: SCHOOL_FOCUS_ZOOM,
      duration: 700,
    });
  }, []);

  const goToSchoolAtIndex = useCallback(
    (index) => {
      if (!mappableSchools.length) return;
      const wrapped = ((index % mappableSchools.length) + mappableSchools.length) % mappableSchools.length;
      selectSchoolPin(mappableSchools[wrapped]);
      setTrailScope('school');
    },
    [mappableSchools, selectSchoolPin]
  );

  const goToPrevSchool = useCallback(() => {
    const start = focusedSchoolIndex >= 0 ? focusedSchoolIndex : 0;
    goToSchoolAtIndex(start - 1);
  }, [focusedSchoolIndex, goToSchoolAtIndex]);

  const goToNextSchool = useCallback(() => {
    const start = focusedSchoolIndex >= 0 ? focusedSchoolIndex : -1;
    goToSchoolAtIndex(start + 1);
  }, [focusedSchoolIndex, goToSchoolAtIndex]);

  /** Always jump to the instructor/class assigned school (starred home campus). */
  const goToHomeSchool = useCallback(() => {
    if (!classSchoolPin) return;
    const pin =
      mappableSchools.find((school) => school.id === classSchoolPin.id) ||
      mappableSchools.find(
        (school) =>
          schoolLabelsMatch(school.name, classSchoolPin.name) ||
          schoolLabelsMatch(school.dataLabel, classSchoolPin.name)
      ) ||
      classSchoolPin;
    setTrailScope('school');
    selectSchoolPin(pin);
  }, [classSchoolPin, mappableSchools, selectSchoolPin]);

  const focusMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Location is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(location);
        setIsLocating(false);
        mapInstanceRef.current?.flyTo({
          center: [location.lng, location.lat],
          zoom: 15,
          duration: 900,
        });
      },
      (error) => {
        const messages = {
          1: 'Location permission was denied.',
          2: 'Your location is currently unavailable.',
          3: 'Finding your location timed out.',
        };
        setGeoError(messages[error.code] || 'Unable to find your location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Generate a code (e.g., session identifier)
  const generateCode = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const school = filters.school || 'PUBLIC';
    const instructor = filters.instructor || 'GUEST';
    const period = filters.period || 'N/A';
    const group = filters.group || 'GUEST';
    return `${school}-${instructor}-${period}-${group}-${timestamp.toString(36).slice(-4).toUpperCase()}-${random}`;
  }, [filters]);

  /** Resolve the MapLibre map from react-map-gl's MapRef. */
  const getMapLibreMap = useCallback(() => {
    const ref = mapInstanceRef.current;
    if (!ref) return null;
    if (typeof ref.getMap === 'function') return ref.getMap();
    if (typeof ref.getCanvas === 'function') return ref;
    return null;
  }, []);

  /**
   * Save map PNG. html2canvas cannot read WebGL map tiles (blank white map) — snapshot the
   * MapLibre canvas after idle, swap it into the clone as an <img>, and strip backdrop-blur
   * so overlay card text stays sharp.
   */
  const handleShareScreenshot = useCallback(async () => {
    if (!screenshotRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const map = getMapLibreMap();
      let mapDataUrl = '';
      if (map?.getCanvas) {
        await new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          if (typeof map.once === 'function') {
            map.once('idle', done);
            if (typeof map.triggerRepaint === 'function') map.triggerRepaint();
            else map.setBearing?.(map.getBearing?.() ?? 0);
          } else {
            done();
          }
          // Safety: never hang if idle never fires.
          setTimeout(done, 1200);
        });
        try {
          mapDataUrl = map.getCanvas().toDataURL('image/png');
        } catch (err) {
          console.warn('Map canvas export failed; overlay-only capture will be blank underneath.', err);
        }
      }

      const canvas = await html2canvas(screenshotRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        logging: false,
        useCORS: true,
        onclone: (_doc, element) => {
          element.querySelectorAll('[data-export-hide]').forEach((node) => {
            node.style.display = 'none';
          });
          // Replace MapLibre WebGL canvases with the raster snapshot (html2canvas can't sample them).
          if (mapDataUrl) {
            const mapCanvases = element.querySelectorAll(
              'canvas.maplibregl-canvas, .maplibregl-canvas, .maplibregl-map canvas, canvas'
            );
            const seen = new Set();
            mapCanvases.forEach((node) => {
              if (seen.has(node) || !(node instanceof HTMLCanvasElement)) return;
              seen.add(node);
              const parent = node.parentElement;
              if (!parent) return;
              const img = _doc.createElement('img');
              img.src = mapDataUrl;
              img.alt = '';
              const width = node.offsetWidth || node.width || parent.clientWidth;
              const height = node.offsetHeight || node.height || parent.clientHeight;
              img.width = width;
              img.height = height;
              img.style.cssText = [
                'display:block',
                `width:${width}px`,
                `height:${height}px`,
                'max-width:none',
                'object-fit:cover',
              ].join(';');
              parent.replaceChild(img, node);
            });
          }
          // backdrop-blur + translucent panels rasterize as muddy/pixelated text.
          element.querySelectorAll('*').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.style.backdropFilter = 'none';
            node.style.webkitBackdropFilter = 'none';
            const className = typeof node.className === 'string' ? node.className : '';
            if (className.includes('backdrop-blur') || /bg-white\/\d+/.test(className)) {
              node.style.setProperty('background-color', '#ffffff', 'important');
            }
          });
        },
      });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height + 90;
      const ctx = finalCanvas.getContext('2d');

      ctx.drawImage(canvas, 0, 0);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, canvas.height, finalCanvas.width, 90);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, canvas.height, finalCanvas.width, 90);

      const now = new Date();
      const timestamp = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const schoolInfo = filters.school || 'Public';
      const classInfo = filters.instructor || 'Guest';
      const periodInfo = filters.period || 'N/A';
      const groupInfo = filters.group || 'Public';
      const code = generateCode();

      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      const labelY = canvas.height + 28;
      const valueY = canvas.height + 52;
      const codeY = canvas.height + 76;

      ctx.fillText('Timestamp:', 30, labelY);
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(timestamp, 140, labelY);

      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('Group:', 30, valueY);
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(`${schoolInfo} - ${classInfo} - ${periodInfo} - ${groupInfo}`, 100, valueY);

      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      const codeLabel = 'Code:';
      const codeLabelWidth = ctx.measureText(codeLabel).width;
      ctx.fillText(codeLabel, finalCanvas.width - 200, codeY);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(code, finalCanvas.width - 200 + codeLabelWidth + 10, codeY);

      await new Promise((resolve) => {
        finalCanvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `air-quality-heatmap-${now.toISOString().split('T')[0]}-${code}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          resolve();
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('Failed to capture screenshot. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [filters, generateCode, getMapLibreMap, isCapturing]);

  return (
    <div className="h-[calc(100vh-6.5rem)] min-h-[620px]">
      {/* Screenshot container — everything the Share button captures */}
      <div ref={screenshotRef} className="relative h-full overflow-hidden rounded-2xl bg-slate-100 shadow-lg">
        {/* Floating controls stay visible without consuming map width. */}
        <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white p-2 shadow-lg sm:left-4 sm:right-auto sm:max-w-[calc(100%-2rem)]">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-gray-900">Air Quality Map</p>
            <p className="truncate text-[10px] text-gray-500">
              {showHeatmap
                ? `${selectedCity.city} · ${openaqHeatmap?.source === 'waqi' ? 'WAQI' : 'OpenAQ'} reference`
                : browsingWorld || !hasSchoolSelection
                  ? `${browsingWorld ? 'World' : 'Schools'} · ${mappableSchools.length} with data · click a campus for trails`
                  : `Group trails · ${trailScope} · ${dateRangeLabel}`}
            </p>
          </div>
          <div className="hidden h-7 w-px bg-gray-200 sm:block" />
          <div className="flex gap-1.5">
            {Object.entries(metricThemes).map(([key, metric]) => (
              <button
                key={key}
                onClick={() => setSelectedMetric(key)}
                title={metric.label}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedMetric === key
                    ? `${metric.bg} text-white shadow-sm`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <div className="hidden h-5 w-px bg-gray-200 sm:block" />

          <div
            className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
            role="group"
            aria-label="Trail compare scope"
          >
            {[
              { id: 'group', label: 'Group' },
              { id: 'class', label: 'Class' },
              { id: 'school', label: 'School' },
              { id: 'world', label: 'World' },
            ].map((scope) => (
              <button
                key={scope.id}
                type="button"
                aria-pressed={trailScope === scope.id}
                onClick={() => selectMapScope(scope.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  trailScope === scope.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="hidden h-5 w-px bg-gray-200 sm:block" />

          <button
            type="button"
            aria-pressed={showHeatmap}
            onClick={() => setShowHeatmap((visible) => !visible)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              showHeatmap
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
            Heatmap {showHeatmap ? 'on' : 'off'}
          </button>

          {showHeatmap && (
            <>
              <div className="flex gap-1.5">
                {PRESET_CITIES.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => setSelectedCityId(city.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedCityId === city.id
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {city.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                <span className="hidden text-[10px] font-bold uppercase tracking-wider text-gray-500 lg:inline lg:mr-2">Accessible</span>
                <button
                  type="button"
                  aria-label="Toggle color-vision accessible heatmap colors"
                  aria-pressed={displayMode === 'accessible'}
                  onClick={() => setDisplayMode(prev => prev === 'default' ? 'accessible' : 'default')}
                  className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
                    displayMode === 'accessible' ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${
                      displayMode === 'accessible' ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            data-export-hide="true"
            onClick={handleShareScreenshot}
            disabled={isCapturing}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{isCapturing ? 'Capturing…' : 'Save map'}</span>
          </button>
        </div>

        {/* The map is the page; summaries are compact overlays, not a separate column. */}
        <div className="h-full">
          {/* Map */}
          <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {showHeatmap && (usingOpenAQHeatmap || usingClassHeatmap) && (
              <p className="absolute left-4 top-20 z-20 max-w-sm rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-emerald-700 shadow">
                Visualization source:{' '}
                {[
                  usingOpenAQHeatmap
                    ? `${openaqHeatmap?.source === 'waqi' ? 'WAQI' : 'OpenAQ'} near ${selectedCity.city}`
                    : null,
                  usingClassHeatmap ? 'your Raw Data measurements' : null,
                ]
                  .filter(Boolean)
                  .join(' + ')}
                .
              </p>
            )}

            <div
              className="relative h-full flex-1 overflow-hidden"
            >
              <MapView
                ref={mapInstanceRef}
                preserveDrawingBuffer
                initialViewState={{
                  longitude: mapCenter.lng,
                  latitude: mapCenter.lat,
                  zoom: activeSchoolPin ? SCHOOL_FOCUS_ZOOM : DEFAULT_MAP_ZOOM,
                }}
                mapStyle={MAP_STYLE_URL}
                style={{ width: '100%', height: '100%' }}
                onLoad={() => {
                  setIsLoaded(true);
                  setMapLoadError('');
                }}
                onError={(event) => {
                  if (!isLoaded) {
                    setMapLoadError(event?.error?.message || 'The map style or tiles failed to load.');
                  }
                }}
                onRemove={() => setIsLoaded(false)}
              >
                <NavigationControl position="top-right" showCompass={false} />
                <FullscreenControl position="top-right" />

                {showHeatmap && heatmapData.features.length > 0 && (
                  <Source id="air-quality-data" type="geojson" data={heatmapData}>
                    <Layer {...heatmapLayer} />
                  </Source>
                )}

                {trailData.features.length > 0 && (
                  <Source id="measurement-trail-data" type="geojson" data={trailData}>
                    <Layer {...trailLayer} />
                  </Source>
                )}

                {trailMarkerData.features.length > 0 && (
                  <Source id="measurement-trail-points" type="geojson" data={trailMarkerData}>
                    <Layer {...trailMarkerLayer} />
                  </Source>
                )}

                {userLocation && (
                  <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
                    <div
                      className="h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_5px_rgba(14,165,233,0.25)]"
                      title="Your current location"
                      aria-label="Your current location"
                    />
                  </Marker>
                )}

                {mappableSchools.map((school) => {
                  const isFocused = hasSchoolSelection && activeSchoolPin?.id === school.id;
                  const home = isHomeSchool(school);
                  return (
                    <Marker
                      key={school.id}
                      longitude={school.lng}
                      latitude={school.lat}
                      anchor="bottom"
                    >
                      <button
                        type="button"
                        title={school.name}
                        aria-label={`Show ${school.name}`}
                        data-testid={`school-pin-${school.id}`}
                        aria-pressed={isFocused}
                        onClick={() => selectSchoolPin(school)}
                        className={`relative flex flex-col items-center ${
                          isFocused ? 'z-10' : 'opacity-90'
                        }`}
                      >
                        {home && (
                          <span
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow"
                            title="Your school"
                            aria-hidden="true"
                          >
                            <Star className="h-2.5 w-2.5 fill-current" />
                          </span>
                        )}
                        <span
                          className={`flex h-8 min-w-8 items-center justify-center rounded-full border-2 px-2 text-[10px] font-bold text-white shadow-lg ${
                            home ? 'border-amber-300' : 'border-white'
                          } ${
                            isFocused ? 'bg-blue-600 scale-110' : home ? 'bg-blue-700' : 'bg-slate-600'
                          }`}
                        >
                          {school.shortLabel}
                        </span>
                      </button>
                    </Marker>
                  );
                })}

                {hasSchoolSelection && activeSchoolPin && schoolPinOpen && (
                  <Popup
                    longitude={activeSchoolPin.lng}
                    latitude={activeSchoolPin.lat}
                    anchor="bottom"
                    offset={44}
                    closeOnClick={false}
                    onClose={() => setSchoolPinOpen(false)}
                  >
                    <div className="max-w-[260px] pr-1">
                      <p className="text-sm font-bold leading-snug text-gray-900">
                        {activeSchoolPin.name}
                      </p>
                      {isHomeSchool(activeSchoolPin) && (
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          Your school
                        </p>
                      )}
                      {typeof onOpenRawData === 'function' && (
                        <button
                          type="button"
                          className="mt-2 w-full rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          onClick={() => {
                            onOpenRawData({
                              schoolName: activeSchoolPin.name,
                              schoolDataLabel: activeSchoolPin.dataLabel || activeSchoolPin.name,
                            });
                          }}
                        >
                          Raw Data
                        </button>
                      )}
                    </div>
                  </Popup>
                )}
              </MapView>

              {mappableSchools.length > 0 && (
                <div className="absolute right-12 top-2.5 z-10 flex items-center gap-1 rounded bg-white p-0.5 shadow-md">
                  <button
                    type="button"
                    title="Previous school"
                    aria-label="Previous school"
                    onClick={goToPrevSchool}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Next school"
                    aria-label="Next school"
                    onClick={goToNextSchool}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {classSchoolPin && (
                    <button
                      type="button"
                      title={`Go to your school (${classSchoolPin.name})`}
                      aria-label="Center map on your school"
                      onClick={goToHomeSchool}
                      className="flex h-7 w-7 items-center justify-center rounded text-amber-600 hover:bg-amber-50"
                    >
                      <GraduationCap className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                title="Go to my location"
                aria-label={isLocating ? 'Finding your location' : 'Center map on your location'}
                onClick={focusMyLocation}
                disabled={isLocating}
                className={`absolute z-10 flex h-8 w-8 items-center justify-center rounded bg-white text-gray-700 shadow-md hover:bg-gray-50 disabled:cursor-wait disabled:text-sky-500 ${
                  mappableSchools.length > 0 ? 'right-12 top-12' : 'right-[5.5rem] top-2.5'
                }`}
              >
                <LocateFixed className={`h-5 w-5 ${isLocating ? 'animate-pulse' : ''}`} />
              </button>

              {geoError && (
                <button
                  type="button"
                  role="status"
                  onClick={() => setGeoError('')}
                  className="absolute right-3 top-14 z-20 max-w-xs rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-xs text-amber-800 shadow-lg"
                  title="Dismiss"
                >
                  {geoError} Click to dismiss.
                </button>
              )}

              {mapLoadError && (
                <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-20">
                  <div className="max-w-lg mx-auto px-6 py-5 bg-white border border-rose-200 rounded-2xl shadow-sm">
                    <p className="text-base font-bold text-rose-700 mb-2">Map loading error</p>
                    <p className="text-sm text-gray-700">{mapLoadError}</p>
                    <p className="text-xs text-gray-500 mt-3">
                      Check the configured map style URL and your network connection.
                    </p>
                  </div>
                </div>
              )}

              {showHeatmap && isLoaded && openaqStatus !== 'loading' && heatmapData.features.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2">
                  <div className="rounded-xl border border-amber-200 bg-white px-6 py-4 shadow-lg">
                    <p className="text-center text-sm font-bold text-gray-800">No heatmap data</p>
                    <p className="mt-1 text-center text-xs text-gray-500">
                      {openaqStatus === 'error'
                        ? 'Reference sensors could not be reached, and there are no geotagged Raw Data points yet.'
                        : `No ${metricThemes[selectedMetric].label} readings near ${selectedCity.label}, and no geotagged class measurements to show.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Map Legend - Continuous Gradient */}
              {showHeatmap && heatmapData.features.length > 0 && (
                <div className="absolute bottom-3 left-3 z-10 min-w-[220px] rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg sm:bottom-4 sm:left-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Air Quality Gradient</p>
                  <div className="w-56 h-4 rounded overflow-hidden mb-2" style={{
                    background: `linear-gradient(to right, ${(displayMode === 'accessible' ? accessibleGradient : heatmapGradient).slice(1).join(', ')})`
                  }} />
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>Good</span>
                    <span>Moderate</span>
                    <span>Unhealthy</span>
                    <span>Very Unhealthy</span>
                  </div>
                </div>
              )}

              {/* Trail legend — one color per group within the selected Group/Class/School scope */}
              {trailLegendItems.length > 0 && (
                <div className={`absolute left-3 z-10 max-w-[220px] rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg ${
                  showHeatmap && heatmapData.features.length > 0
                    ? 'bottom-28 sm:bottom-4 sm:left-[270px]'
                    : 'bottom-3 sm:bottom-4 sm:left-4'
                }`}>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    {trailScope === 'group'
                      ? 'Group trail'
                      : trailScope === 'class'
                        ? 'Class trails · by group'
                        : 'School trails · by group'}
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {trailLegendItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-gray-500">
                    Lines connect each group&apos;s geotagged spots in time order for the same day.
                    {trailMarkers.length > 0 ? ' Dots are single-fix days.' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Compact summary cards float over the map as information panels. */}
          <div className="absolute right-3 top-20 z-20 hidden w-44 flex-col gap-1.5 lg:flex">
            {showHeatmap && (
              <div
                className="min-w-[145px] rounded-lg border bg-white px-3 py-2 shadow-lg"
                style={{ borderColor: theme.primary }}
              >
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">City Avg</p>
                  <button onClick={() => setShowStatusInfo(true)} title="View AQI criteria">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold" style={{ color: theme.primary }}>{stats.city ?? '—'}</span>
                  {stats.city != null && <span className="text-xs font-semibold text-gray-400">{metricThemes[selectedMetric].unit}</span>}
                </div>
                {stats.city != null && (
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: getColorForValue(stats.city), color: '#1F2937' }}
                  >
                    {getStatusLabel(stats.city)}
                  </span>
                )}
              </div>
            )}

            <div className="min-w-[145px] rounded-lg border border-blue-100 bg-white px-3 py-2 shadow-lg">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">School Avg</p>
              <p className="text-[10px] text-blue-500 font-bold uppercase truncate">
                {browsingWorld || !hasSchoolSelection
                  ? (browsingWorld ? 'World' : 'All schools')
                  : (activeSchoolPin?.name || filters.school || '—')}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-blue-600">{stats.school ?? '—'}</span>
                {stats.school != null && <span className="text-xs font-semibold text-gray-400">{metricThemes[selectedMetric].unit}</span>}
              </div>
            </div>

            <div className="min-w-[145px] rounded-lg border border-indigo-100 bg-white px-3 py-2 shadow-lg">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Group Avg</p>
              <p className="text-[10px] text-indigo-500 font-bold uppercase truncate">
                {filters.group ? `Group ${filters.group}` : 'All groups'}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-indigo-600">{stats.group ?? '—'}</span>
                {stats.group != null && <span className="text-xs font-semibold text-gray-400">{metricThemes[selectedMetric].unit}</span>}
              </div>
            </div>

            {bestLocation && worstLocation && (
              <>
                <div
                  className="min-w-[145px] rounded-lg border bg-white px-3 py-2 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${getColorForValue(bestLocation[selectedMetric])}30 0%, white 100%)`,
                    borderColor: getColorForValue(bestLocation[selectedMetric]),
                  }}
                >
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Best Area</p>
                  <p className="text-[10px] text-green-600 font-bold uppercase truncate">{bestLocation.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-green-600">{Number(bestLocation[selectedMetric]).toFixed(1)}</span>
                    <span className="text-xs font-semibold text-gray-400">{metricThemes[selectedMetric].unit}</span>
                  </div>
                </div>

                <div
                  className="min-w-[145px] rounded-lg border bg-white px-3 py-2 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${getColorForValue(worstLocation[selectedMetric])}30 0%, white 100%)`,
                    borderColor: getColorForValue(worstLocation[selectedMetric]),
                  }}
                >
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Needs Attention</p>
                  <p className="text-[10px] text-orange-600 font-bold uppercase truncate">{worstLocation.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-orange-600">{Number(worstLocation[selectedMetric]).toFixed(1)}</span>
                    <span className="text-xs font-semibold text-gray-400">{metricThemes[selectedMetric].unit}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="absolute right-3 top-20 z-20 flex max-w-[48%] flex-wrap justify-end gap-1 lg:hidden">
            {[
              ...(showHeatmap ? [['City', stats.city, theme.primary]] : []),
              ['School', stats.school, '#2563EB'],
              ['Group', stats.group, '#4F46E5'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border bg-white px-2 py-1 shadow">
                <span className="mr-1 text-[9px] font-bold uppercase text-gray-500">{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* End Screenshot Container */}

      {/* Status Info Modal */}
      <StatusInfoModal
        isOpen={showStatusInfo}
        onClose={() => setShowStatusInfo(false)}
        theme={theme}
      />
    </div>
  );
};

export default HeatMapDashboard;
