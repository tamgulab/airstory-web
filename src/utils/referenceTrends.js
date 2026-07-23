/**
 * Reference city trends for Analysis. OpenAQ is preferred at runtime; these deterministic
 * baselines keep the comparison readable when a city/metric has no nearby OpenAQ sensor.
 */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Baseline levels + coordinates match the three Heat Map demo cities.
export const REFERENCE_LOCATIONS = [
  { name: "Philadelphia", lat: 39.9526, lng: -75.1652, pm25: 12, co: 0.42, temp: 22, humidity: 52 },
  { name: "New York", lat: 40.7128, lng: -74.006, pm25: 11, co: 0.4, temp: 21, humidity: 55 },
  { name: "Hanoi", lat: 21.0278, lng: 105.8342, pm25: 28, co: 0.68, temp: 29, humidity: 74 },
];

/**
 * Deterministic week-shaped series for a reference location (small day-to-day variation).
 */
export function getReferenceWeekSeries(locationName, metricKey) {
  const loc =
    REFERENCE_LOCATIONS.find((l) => l.name === locationName) || REFERENCE_LOCATIONS[0];
  const base = Number(loc[metricKey]);
  if (Number.isNaN(base)) return WEEKDAYS.map((day) => ({ day, value: 0 }));

  return WEEKDAYS.map((day, i) => {
    const wobble = 1 + 0.06 * Math.sin((i + 1) * 1.2);
    let value = base * wobble;
    if (metricKey === "co") value = Math.round(value * 100) / 100;
    else if (metricKey === "temp" || metricKey === "humidity") value = Math.round(value);
    else value = Math.round(value);
    return { day, value };
  });
}
