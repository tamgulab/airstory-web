/**
 * Shared health-threshold (AQI-style) interpretation, used by both the Heat Map and Analysis
 * so a PM2.5 number always maps to the same Good/Moderate/Unhealthy label + color everywhere.
 */
export const AQI_RANGES = {
  pm25: [
    { max: 12, label: 'Good', color: '#A7E8B1' },
    { max: 35, label: 'Moderate', color: '#FFF3B0' },
    { max: 55, label: 'Unhealthy (Sensitive)', color: '#FFD6A5' },
    { max: 150, label: 'Unhealthy', color: '#FFB8B8' },
    { max: Infinity, label: 'Very Unhealthy', color: '#DDA0DD' },
  ],
  // CO (ppm) — simplified bands for classroom discussion, not a regulatory AQI table.
  co: [
    { max: 4.4, label: 'Good', color: '#A7E8B1' },
    { max: 9.4, label: 'Moderate', color: '#FFF3B0' },
    { max: 12.4, label: 'Unhealthy (Sensitive)', color: '#FFD6A5' },
    { max: 15.4, label: 'Unhealthy', color: '#FFB8B8' },
    { max: Infinity, label: 'Very Unhealthy', color: '#DDA0DD' },
  ],
};

/** Metrics without an established simple health-threshold table (shown as plain numbers). */
export const HEALTH_THRESHOLD_METRICS = Object.keys(AQI_RANGES);

export const getColorForValue = (value, metric = 'pm25') => {
  const ranges = AQI_RANGES[metric] || AQI_RANGES.pm25;
  for (const range of ranges) {
    if (value <= range.max) return range.color;
  }
  return ranges[ranges.length - 1].color;
};

export const getStatusLabel = (value, metric = 'pm25') => {
  const ranges = AQI_RANGES[metric] || AQI_RANGES.pm25;
  for (const range of ranges) {
    if (value <= range.max) return range.label;
  }
  return ranges[ranges.length - 1].label;
};

export const hasHealthThreshold = (metric) => HEALTH_THRESHOLD_METRICS.includes(metric);
