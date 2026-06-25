import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Info, Download, Share2 } from 'lucide-react';
import { GoogleMap, useJsApiLoader, HeatmapLayer, Marker, InfoWindow } from '@react-google-maps/api';
import html2canvas from 'html2canvas';
import { getImportedMeasurements } from '../utils/importedData';
import { getHeatmapPoints } from '../api/data';
import { apiRequest } from '../api/http';

const AQI_RANGES = {
  pm25: [
    { max: 12, label: 'Good', color: '#A7E8B1' },
    { max: 35, label: 'Moderate', color: '#FFF3B0' },
    { max: 55, label: 'Unhealthy (Sensitive)', color: '#FFD6A5' },
    { max: 150, label: 'Unhealthy', color: '#FFB8B8' },
    { max: Infinity, label: 'Very Unhealthy', color: '#DDA0DD' },
  ],
};

const getColorForValue = (value, metric = 'pm25') => {
  const ranges = AQI_RANGES[metric] || AQI_RANGES.pm25;
  for (let range of ranges) {
    if (value <= range.max) return range.color;
  }
  return ranges[ranges.length - 1].color;
};

const getStatusLabel = (value, metric = 'pm25') => {
  const ranges = AQI_RANGES[metric] || AQI_RANGES.pm25;
  for (let range of ranges) {
    if (value <= range.max) return range.label;
  }
  return ranges[ranges.length - 1].label;
};

// Stable references — new [] / {} each render makes LoadScript reload the Maps API (flicker / “bouncing”).
const GOOGLE_MAP_LIBRARIES = Object.freeze(['visualization']);
const MAP_CONTAINER_STYLE = Object.freeze({ width: '100%', height: '100%' });

// Silver/desaturated map styling
const mapStyles = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
];

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

// Color-vision accessible palette (Viridis-like or specific colorblind safe colors)
const accessibleGradient = [
  'rgba(0, 255, 255, 0)',
  'rgba(68, 1, 84, 1)',
  'rgba(59, 82, 139, 1)',
  'rgba(33, 145, 140, 1)',
  'rgba(94, 201, 98, 1)',
  'rgba(253, 231, 37, 1)',
  'rgba(255, 255, 255, 1)'
];

/**
 * OpenAQ + map chrome: always Philadelphia for this program.
 * (Avoids legacy per-school centers that still pointed at NYC / Manhattan in older builds.)
 */
const PROGRAM_REGION = { city: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652, radius: 15000 };

/** Program partner school — 1400 W Olney Ave, Philadelphia, PA (approx. entrance). */
const PHILADELPHIA_HS_FOR_GIRLS = Object.freeze({
  name: 'Philadelphia High School for Girls',
  shortLabel: 'PHSG',
  address: '1400 W Olney Ave, Philadelphia, PA 19141',
  lat: 40.03625,
  lng: -75.14504,
});

/** Zoom when jumping to the partner school from the map control. */
const SCHOOL_FOCUS_ZOOM = 16;

/** Inline SVG (Lucide-style graduation cap) for the custom map control — avoids ReactDOM on the control node. */
const SCHOOL_MAP_CONTROL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';

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
  workspaceId,
  selectedMetric,
  setSelectedMetric,
  filters,
  theme,
  metricThemes,
  importedDataVersion,
}) => {
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [selectedTimeRange] = useState('all-time');
  const [displayMode, setDisplayMode] = useState('default'); // 'default' or 'accessible'
  const [, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [schoolPinOpen, setSchoolPinOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const screenshotRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const schoolMapControlRef = useRef(null);
  /** When set, map + heatmap use aggregated workspace measurements (real lat/lng from DB). */
  const [workspaceHeatmap, setWorkspaceHeatmap] = useState(null);
  const [openaqHeatmap, setOpenaqHeatmap] = useState(null);
  const importedMeasurements = useMemo(
    () => getImportedMeasurements(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importedDataVersion]
  );

  // Get Google Maps API key from environment variable
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // Load the Maps JS API once for the app's lifetime. useJsApiLoader is a module-level singleton,
  // so it survives the mount/unmount churn (auth flow, tab switches) that made the old <LoadScript>
  // hang on "Loading map…" when window.google was already partially defined from an aborted load.
  const { isLoaded: isMapsApiLoaded, loadError } = useJsApiLoader({
    id: 'airstory-google-maps',
    googleMapsApiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
    version: 'quarterly',
  });
  const mapsLoadError = loadError
    ? 'Google Maps failed to load. This is usually caused by an invalid API key, missing billing, or referrer restrictions for this domain.'
    : '';

  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceHeatmap(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getHeatmapPoints(workspaceId, selectedMetric);
        if (cancelled) return;
        setWorkspaceHeatmap({ points: data.points || [] });
      } catch {
        if (cancelled) return;
        setWorkspaceHeatmap(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedMetric]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({
          lat: String(PROGRAM_REGION.lat),
          lng: String(PROGRAM_REGION.lng),
          metric: selectedMetric,
          radius: String(PROGRAM_REGION.radius),
          limit: '25',
        });
        const data = await apiRequest(`/analytics/openaq/heatmap?${q.toString()}`);
        if (cancelled) return;
        setOpenaqHeatmap({ points: data.points || [] });
      } catch {
        if (cancelled) return;
        setOpenaqHeatmap(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMetric]);

  const importedPoints = useMemo(() => {
    return importedMeasurements
      .filter((row) => {
        if (filters.school && row.school && row.school !== filters.school) return false;
        if (filters.instructor && row.instructor && row.instructor !== filters.instructor) return false;
        if (filters.period && row.period && row.period !== filters.period) return false;
        if (filters.group && row.group && row.group !== filters.group) return false;
        return true;
      })
      .map((row) => {
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
          group: row.group || '',
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !Number.isNaN(p.timestamp.getTime()));
  }, [importedMeasurements, filters]);

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

  const usingWorkspaceHeatmap =
    Boolean(workspaceId && workspaceHeatmap?.points && workspaceHeatmap.points.length > 0);
  const usingOpenAQHeatmap = Boolean(openaqHeatmap?.points?.length);

  // Aggregate filtered data by location (demo) — or use real workspace buckets from API
  const locations = useMemo(() => {
    if (usingOpenAQHeatmap) {
      return (openaqHeatmap?.points || []).map((p, i) => {
        const v = Number(p.value);
        const row = {
          id: `openaq-${i}`,
          name: p.location_name || `OpenAQ Site ${i + 1}`,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          pm25: 0,
          co: 0,
          temp: 0,
          humidity: 0,
        };
        row[selectedMetric] = Number.isFinite(v) ? v : 0;
        return row;
      });
    }

    const pts = workspaceHeatmap?.points;
    if (usingWorkspaceHeatmap) {
      return pts.map((p, i) => {
        const v = Number(p.value);
        const row = {
          id: `ws-${i}`,
          name: `Site ${i + 1} (${p.point_count} readings)`,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          pm25: 0,
          co: 0,
          temp: 0,
          humidity: 0,
        };
        row[selectedMetric] = Number.isFinite(v) ? v : 0;
        return row;
      });
    }

    const locationMap = {};

    filteredLocations.forEach((point) => {
      const key = point.name;
      if (!locationMap[key]) {
        locationMap[key] = {
          ...point,
          count: 1,
          pm25Sum: point.pm25,
          coSum: point.co,
          tempSum: point.temp,
          humiditySum: point.humidity,
        };
      } else {
        locationMap[key].count++;
        locationMap[key].pm25Sum += point.pm25;
        locationMap[key].coSum += point.co;
        locationMap[key].tempSum += point.temp;
        locationMap[key].humiditySum += point.humidity;
      }
    });

    return Object.values(locationMap).map((loc) => ({
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      pm25: Math.round(loc.pm25Sum / loc.count),
      co: parseFloat((loc.coSum / loc.count).toFixed(2)),
      temp: Math.round(loc.tempSum / loc.count),
      humidity: Math.round(loc.humiditySum / loc.count),
    }));
  }, [filteredLocations, workspaceHeatmap, usingWorkspaceHeatmap, selectedMetric, usingOpenAQHeatmap, openaqHeatmap]);

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
    if (!locations.length) {
      return { city: null, school: null, group: null };
    }

    const metric = selectedMetric;

    const cityAvg = Math.round(
      locations.reduce((sum, loc) => sum + parseFloat(loc[metric] ?? 0), 0) / Math.max(locations.length, 1)
    );

    // School/group cards should always come from your class CSV/workspace records, never OpenAQ city feed.
    const sourceForSchoolAndGroup = filteredImported;

    // School Average (based on current filters)
    const schoolData = sourceForSchoolAndGroup.filter(item => item.school === filters.school);
    const schoolAvg = schoolData.length > 0
      ? Math.round(schoolData.reduce((sum, item) => sum + parseFloat(item[metric]), 0) / schoolData.length)
      : null;

    // Group Average (based on current filters)
    const groupData = sourceForSchoolAndGroup.filter(
      item => item.group === filters.group && item.school === filters.school
    );
    const groupAvg = groupData.length > 0
      ? Math.round(groupData.reduce((sum, item) => sum + parseFloat(item[metric]), 0) / groupData.length)
      : null;

    return { city: cityAvg, school: schoolAvg, group: groupAvg };
  }, [
    filteredImported,
    selectedMetric,
    filters,
    locations,
  ]);

  const bestLocation = locations.length
    ? locations.reduce((best, loc) => (loc[selectedMetric] < best[selectedMetric] ? loc : best))
    : null;

  const worstLocation = locations.length
    ? locations.reduce((worst, loc) => (loc[selectedMetric] > worst[selectedMetric] ? loc : worst))
    : null;

  const mapCenter = useMemo(() => {
    if (usingOpenAQHeatmap) {
      return { lat: PROGRAM_REGION.lat, lng: PROGRAM_REGION.lng };
    }
    const pts = workspaceHeatmap?.points;
    if (workspaceId && pts?.length) {
      const lat = pts.reduce((s, p) => s + Number(p.latitude), 0) / pts.length;
      const lng = pts.reduce((s, p) => s + Number(p.longitude), 0) / pts.length;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (locations.length) {
      const lat = locations.reduce((s, p) => s + Number(p.lat), 0) / locations.length;
      const lng = locations.reduce((s, p) => s + Number(p.lng), 0) / locations.length;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return { lat: PROGRAM_REGION.lat, lng: PROGRAM_REGION.lng };
  }, [workspaceHeatmap, workspaceId, locations, usingOpenAQHeatmap]);

  // Transform location data to WeightedLocation format for HeatmapLayer
  const heatmapData = useMemo(() => {
    if (!isLoaded || !window.google || !window.google.maps) {
      return [];
    }
    return locations.map(location => {
      const value = location[selectedMetric];
      // Use the AQI value as weight - higher values create more intense heat
      return {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        weight: value
      };
    });
  }, [locations, selectedMetric, isLoaded]);

  // HeatmapLayer options
  const heatmapOptions = useMemo(() => ({
    radius: 40,
    opacity: 0.7,
    dissipating: true,
    gradient: displayMode === 'accessible' ? accessibleGradient : heatmapGradient
  }), [displayMode]);

  const onMapLoad = useCallback((mapInstance) => {
    mapInstanceRef.current = mapInstance;
    setMap(mapInstance);
    setIsLoaded(true);

    if (!window.google?.maps?.ControlPosition) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = `Go to ${PHILADELPHIA_HS_FOR_GIRLS.name}`;
    btn.setAttribute('aria-label', `Center map on ${PHILADELPHIA_HS_FOR_GIRLS.name}`);
    btn.innerHTML = SCHOOL_MAP_CONTROL_SVG;
    Object.assign(btn.style, {
      backgroundColor: '#fff',
      border: 'none',
      borderRadius: '2px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      margin: '10px',
      padding: '9px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    btn.addEventListener('click', () => {
      mapInstance.panTo({
        lat: PHILADELPHIA_HS_FOR_GIRLS.lat,
        lng: PHILADELPHIA_HS_FOR_GIRLS.lng,
      });
      mapInstance.setZoom(SCHOOL_FOCUS_ZOOM);
      setSchoolPinOpen(true);
    });

    wrapper.appendChild(btn);
    mapInstance.controls[window.google.maps.ControlPosition.RIGHT_TOP].insertAt(0, wrapper);
    schoolMapControlRef.current = wrapper;
  }, []);

  const onMapUnmount = useCallback(() => {
    const mapInstance = mapInstanceRef.current;
    const controlEl = schoolMapControlRef.current;
    if (mapInstance && controlEl && window.google?.maps?.ControlPosition) {
      const slot = mapInstance.controls[window.google.maps.ControlPosition.RIGHT_TOP];
      const arr = slot?.getArray?.() || [];
      const idx = arr.indexOf(controlEl);
      if (idx >= 0) slot.removeAt(idx);
    }
    schoolMapControlRef.current = null;
    mapInstanceRef.current = null;
    setMap(null);
    setIsLoaded(false);
  }, []);

  const googleMapOptions = useMemo(
    () => ({
      styles: mapStyles,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    }),
    []
  );

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

  // Capture screenshot with overlays
  const handleShareScreenshot = useCallback(async () => {
    if (!screenshotRef.current || isCapturing) return;
    
    setIsCapturing(true);
    
    try {
      // Wait a bit for any animations to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture the screenshot
      const canvas = await html2canvas(screenshotRef.current, {
        backgroundColor: '#f9fafb',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      
      // Create a new canvas for adding overlays
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height + 90; // Extra space for overlay
      const ctx = finalCanvas.getContext('2d');
      
      // Draw the original screenshot
      ctx.drawImage(canvas, 0, 0);
      
      // Add overlay section at the bottom
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, canvas.height, finalCanvas.width, 90);
      
      // Add subtle shadow/border
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, canvas.height, finalCanvas.width, 90);
      
      // Add timestamp
      const now = new Date();
      const timestamp = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      // Add hierarchy info
      const schoolInfo = filters.school || 'Public';
      const classInfo = filters.instructor || 'Guest';
      const periodInfo = filters.period || 'N/A';
      const groupInfo = filters.group || 'Public';
      
      // Generate code
      const code = generateCode();
      
      // Set text styles for labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      const labelY = canvas.height + 28;
      const valueY = canvas.height + 52;
      const codeY = canvas.height + 76;
      
      // Draw labels and values
      ctx.fillText('Timestamp:', 30, labelY);
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(timestamp, 140, labelY);
      
      // Draw hierarchy info
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('Team:', 30, valueY);
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(`${schoolInfo} - ${classInfo} - ${periodInfo} - ${groupInfo}`, 100, valueY);
      
      // Draw code (right aligned)
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      const codeLabel = 'Code:';
      const codeLabelWidth = ctx.measureText(codeLabel).width;
      ctx.fillText(codeLabel, finalCanvas.width - 200, codeY);
      
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(code, finalCanvas.width - 200 + codeLabelWidth + 10, codeY);
      
      // Convert to blob and download
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
        setIsCapturing(false);
      }, 'image/png');
      
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('Failed to capture screenshot. Please try again.');
      setIsCapturing(false);
    }
  }, [filters, generateCode, isCapturing]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Air Quality Heat Map</h1>
          <p className="text-gray-600">OpenAQ city visualization for {PROGRAM_REGION.city}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleShareScreenshot}
            disabled={isCapturing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share2 className="w-4 h-4" />
            {isCapturing ? 'Capturing...' : 'Share'}
          </button>
          <button 
            onClick={() => alert('Export functionality coming soon')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Screenshot Container - includes metric selector and map/stats */}
      <div ref={screenshotRef} className="space-y-6">
      {/* Metric Selector */}
      <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Select Metric</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range:</span>
            <span className="text-xs font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              {dateRangeLabel}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(metricThemes).map(([key, metric]) => (
            <button 
              key={key} 
              onClick={() => setSelectedMetric(key)}
              className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                selectedMetric === key 
                  ? `${metric.bg} text-white shadow-md scale-105` 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="text-sm font-bold">{metric.label}</div>
              <div className="text-xs opacity-90 mt-0.5">{metric.unit}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Map and Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Interactive Map - 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{PROGRAM_REGION.city} Air Quality Map</h2>
              {usingOpenAQHeatmap ? (
                <p className="text-xs text-emerald-700 mt-1 font-medium">
                  Visualization source: OpenAQ sensors in the Philadelphia region.
                </p>
              ) : usingWorkspaceHeatmap ? (
                <p className="text-xs text-emerald-700 mt-1 font-medium">
                  OpenAQ is unavailable right now, so this is showing your workspace measurements.
                </p>
              ) : null}
            </div>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Mode</span>
              <button 
                onClick={() => setDisplayMode(prev => prev === 'default' ? 'accessible' : 'default')}
                className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
                  displayMode === 'accessible' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${
                    displayMode === 'accessible' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* Google Maps Container */}
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 flex-1" style={{ minHeight: '600px' }}>
            {googleMapsApiKey ? (
              isMapsApiLoaded ? (
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={mapCenter}
                  zoom={12}
                  options={googleMapOptions}
                  onLoad={onMapLoad}
                  onUnmount={onMapUnmount}
                >
                  {isLoaded && heatmapData.length > 0 && (
                    <HeatmapLayer
                      data={heatmapData}
                      options={heatmapOptions}
                    />
                  )}
                  {isLoaded && (
                    <>
                      <Marker
                        position={{
                          lat: PHILADELPHIA_HS_FOR_GIRLS.lat,
                          lng: PHILADELPHIA_HS_FOR_GIRLS.lng,
                        }}
                        zIndex={1000}
                        title={PHILADELPHIA_HS_FOR_GIRLS.name}
                        onClick={() => setSchoolPinOpen(true)}
                        options={{
                          label: {
                            text: PHILADELPHIA_HS_FOR_GIRLS.shortLabel,
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '700',
                          },
                        }}
                      />
                      {schoolPinOpen && (
                        <InfoWindow
                          position={{
                            lat: PHILADELPHIA_HS_FOR_GIRLS.lat,
                            lng: PHILADELPHIA_HS_FOR_GIRLS.lng,
                          }}
                          onCloseClick={() => setSchoolPinOpen(false)}
                        >
                          <div className="max-w-[240px] pr-1">
                            <p className="font-bold text-gray-900 text-sm leading-snug">
                              {PHILADELPHIA_HS_FOR_GIRLS.name}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{PHILADELPHIA_HS_FOR_GIRLS.address}</p>
                            <p className="text-[10px] text-gray-500 mt-2">Partner school (program pin)</p>
                          </div>
                        </InfoWindow>
                      )}
                    </>
                  )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <p className="text-sm text-gray-600 font-medium">Loading map…</p>
                </div>
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center p-6">
                  <p className="text-lg font-semibold text-gray-700 mb-2">Google Maps API Key Required</p>
                  <p className="text-sm text-gray-600 mb-4">
                    Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file
                  </p>
                  <p className="text-xs text-gray-500">
                    Get your API key from{' '}
                    <a 
                      href="https://console.cloud.google.com/google/maps-apis" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Google Cloud Console
                    </a>
                  </p>
                  </div>
              </div>
            )}

            {mapsLoadError && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-20">
                <div className="max-w-lg mx-auto px-6 py-5 bg-white border border-rose-200 rounded-2xl shadow-sm">
                  <p className="text-base font-bold text-rose-700 mb-2">Map loading error</p>
                  <p className="text-sm text-gray-700">{mapsLoadError}</p>
                  <p className="text-xs text-gray-500 mt-3">
                    Tip: In Google Cloud Console, enable “Maps JavaScript API” and restrict the key to
                    <span className="font-mono"> https://haetalkim.github.io/airstory/*</span>.
                  </p>
                </div>
              </div>
            )}

            {isLoaded && heatmapData.length === 0 && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm">
                  <p className="text-lg font-bold text-gray-800 text-center">NO DATA</p>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    No geotagged measurements for the current metric/filter.
                  </p>
                </div>
              </div>
            )}
            
            {/* Map Legend - Continuous Gradient */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg p-5 shadow-lg border border-gray-200 z-10 min-w-[280px]">
              <p className="text-sm font-semibold text-gray-700 mb-3">Air Quality Gradient</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-64 h-5 rounded overflow-hidden" style={{
                  background: `linear-gradient(to right, ${(displayMode === 'accessible' ? accessibleGradient : heatmapGradient).slice(1).join(', ')})`
                }} />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span className="whitespace-nowrap">Good</span>
                <span className="whitespace-nowrap">Moderate</span>
                <span className="whitespace-nowrap">Unhealthy</span>
                <span className="whitespace-nowrap">Very Unhealthy</span>
              </div>
              <p className="text-xs text-gray-500 italic">Weighted by AQI value</p>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            * OpenAQ heat zones • Graduation control (top-right): jump to {PHILADELPHIA_HS_FOR_GIRLS.shortLabel} • Pin: tap for details
          </p>
        </div>

        {/* Stats Sidebar - 1 column */}
        <div className="flex flex-col gap-4 h-full">
          {/* City Average */}
          <div 
            className="bg-white rounded-xl p-5 shadow-md border-2 transition-all duration-300 flex-1 flex flex-col justify-center" 
            style={{ borderColor: theme.primary }}
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-black text-gray-500 uppercase tracking-widest">City Average</p>
              <div className="text-right">
                <span className="text-3xl font-semibold" style={{ color: theme.primary }}>
                  {stats.city ?? 'NO DATA'}
                </span>
                {stats.city != null && (
                  <span className="text-sm font-bold text-gray-400 ml-1">{metricThemes[selectedMetric].unit}</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              {stats.city == null ? (
                <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide bg-gray-100 text-gray-500">
                  NO DATA
                </span>
              ) : (
                <>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-black tracking-wide"
                    style={{ backgroundColor: getColorForValue(stats.city), color: "#1F2937" }}
                  >
                    {getStatusLabel(stats.city)}
                  </span>
                  <button
                    onClick={() => setShowStatusInfo(true)}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    title="View AQI criteria"
                  >
                    <Info className="w-5 h-5 text-gray-400" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* School Average */}
          <div 
            className="bg-white rounded-xl p-5 shadow-md border-2 border-blue-100 flex-1 flex flex-col justify-center"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-black text-gray-500 uppercase tracking-widest">School Average</p>
                <p className="text-xs text-blue-500 font-black uppercase mt-0.5 tracking-tighter">{filters.school}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-blue-600">{stats.school ?? 'NO DATA'}</span>
                {stats.school != null && (
                  <span className="text-sm font-bold text-gray-400 ml-1">{metricThemes[selectedMetric].unit}</span>
                )}
              </div>
            </div>
          </div>

          {/* Group Average */}
          <div 
            className="bg-white rounded-xl p-5 shadow-md border-2 border-indigo-100 flex-1 flex flex-col justify-center"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Group Average</p>
                <p className="text-xs text-indigo-500 font-black uppercase mt-0.5 tracking-tighter">Team {filters.group}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-indigo-600">{stats.group ?? 'NO DATA'}</span>
                {stats.group != null && (
                  <span className="text-sm font-bold text-gray-400 ml-1">{metricThemes[selectedMetric].unit}</span>
                )}
              </div>
            </div>
          </div>

          {/* Best Area / Needs Attention — hidden if no location aggregates */}
          {bestLocation && worstLocation && (
            <>
              <div
                className="bg-gradient-to-br rounded-xl p-5 shadow-md border-2 transition-all duration-300 flex-1 flex flex-col justify-center"
                style={{
                  background: `linear-gradient(135deg, ${getColorForValue(bestLocation[selectedMetric])}30 0%, white 100%)`,
                  borderColor: getColorForValue(bestLocation[selectedMetric]),
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Best Area</p>
                    <p className="text-xs text-green-600 font-black uppercase mt-0.5 tracking-tighter truncate max-w-[120px]">
                      {bestLocation.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-semibold text-green-600">{bestLocation[selectedMetric]}</span>
                    <span className="text-sm font-bold text-gray-400 ml-1">{metricThemes[selectedMetric].unit}</span>
                  </div>
                </div>
              </div>

              <div
                className="bg-gradient-to-br rounded-xl p-5 shadow-md border-2 transition-all duration-300 flex-1 flex flex-col justify-center"
                style={{
                  background: `linear-gradient(135deg, ${getColorForValue(worstLocation[selectedMetric])}30 0%, white 100%)`,
                  borderColor: getColorForValue(worstLocation[selectedMetric]),
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Needs Attention</p>
                    <p className="text-xs text-orange-600 font-black uppercase mt-0.5 tracking-tighter truncate max-w-[120px]">
                      {worstLocation.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-semibold text-orange-600">{worstLocation[selectedMetric]}</span>
                    <span className="text-sm font-bold text-gray-400 ml-1">{metricThemes[selectedMetric].unit}</span>
                  </div>
                </div>
              </div>
            </>
          )}
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
