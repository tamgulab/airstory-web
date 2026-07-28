/**
 * WAQI / aqicn.org — server-side only (token stays off the client).
 * Used as a Hanoi (and sparse-coverage) fallback when OpenAQ has no nearby sensor.
 * @see https://aqicn.org/json-api/doc/
 */

const WAQI_BASE = "https://api.waqi.info";

function roundCoord(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Reverse US EPA PM2.5 AQI → approximate µg/m³ so WAQI lines compare with
 * student Raw Data / OpenAQ concentrations.
 */
export function aqiPm25ToUgm3(aqi) {
  if (aqi === null || aqi === undefined || aqi === "") return null;
  const x = Number(aqi);
  if (!Number.isFinite(x) || x < 0) return null;
  const breaks = [
    { iLo: 0, iHi: 50, cLo: 0.0, cHi: 12.0 },
    { iLo: 51, iHi: 100, cLo: 12.1, cHi: 35.4 },
    { iLo: 101, iHi: 150, cLo: 35.5, cHi: 55.4 },
    { iLo: 151, iHi: 200, cLo: 55.5, cHi: 150.4 },
    { iLo: 201, iHi: 300, cLo: 150.5, cHi: 250.4 },
    { iLo: 301, iHi: 400, cLo: 250.5, cHi: 350.4 },
    { iLo: 401, iHi: 500, cLo: 350.5, cHi: 500.4 },
  ];
  const row = breaks.find((b) => x >= b.iLo && x <= b.iHi) || breaks[breaks.length - 1];
  const spanI = row.iHi - row.iLo || 1;
  const conc = ((x - row.iLo) / spanI) * (row.cHi - row.cLo) + row.cLo;
  return Math.round(conc * 100) / 100;
}

function normalizeMetric(metric) {
  const m = String(metric || "pm25").toLowerCase().replace(/\s/g, "");
  if (m === "pm25" || m === "pm2.5") return "pm25";
  if (m === "temp" || m === "temperature") return "temp";
  if (m === "humidity" || m === "rh") return "humidity";
  if (m === "co") return "co";
  return m;
}

/** Prefer the named Hanoi city feed when the pin is near the city center. */
function isNearHanoi(lat, lng) {
  return Math.abs(Number(lat) - 21.0278) < 0.75 && Math.abs(Number(lng) - 105.8342) < 0.75;
}

async function waqiJson(path, token, searchParams) {
  const url = new URL(WAQI_BASE + path);
  url.searchParams.set("token", token);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAQI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.status !== "ok") {
    throw new Error(`WAQI status ${data.status}: ${String(data.data || "").slice(0, 160)}`);
  }
  return data.data;
}

async function fetchWaqiFeed(token, lat, lng) {
  if (isNearHanoi(lat, lng)) {
    try {
      return await waqiJson("/feed/hanoi/", token);
    } catch {
      // Fall through to geo feed.
    }
  }
  return waqiJson(`/feed/geo:${roundCoord(lat)};${roundCoord(lng)}/`, token);
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Daily reference series for Analysis.
 * PM2.5: WAQI forecast/history days (AQI) converted to µg/m³.
 * Temp / humidity: current station reading only (WAQI has no multi-day series for these).
 */
export async function fetchWaqiDailyReference(opts) {
  const { token, lat, lng, dateFrom, dateTo, metric: rawMetric } = opts;
  const metric = normalizeMetric(rawMetric);

  if (!token) {
    return { error: "no_api_key", message: "WAQI_API_TOKEN is not set on the server." };
  }

  const supported = ["pm25", "temp", "humidity"];
  if (!supported.includes(metric)) {
    return {
      error: "unsupported_metric",
      message: `WAQI fallback supports: ${supported.join(", ")}.`,
      points: [],
    };
  }

  const feed = await fetchWaqiFeed(token, lat, lng);
  const locationName = feed?.city?.name || "WAQI station";
  const byDate = {};

  if (metric === "pm25") {
    const days = feed?.forecast?.daily?.pm25 || [];
    days.forEach((entry) => {
      const day = entry?.day;
      const ugm3 = aqiPm25ToUgm3(entry?.avg);
      if (!day || ugm3 == null) return;
      // Keep all WAQI days — student CSV weeks often don't overlap the forecast window.
      byDate[day] = ugm3;
    });
    const live = aqiPm25ToUgm3(feed?.iaqi?.pm25?.v);
    const today = todayUtcDate();
    if (live != null) byDate[today] = live;
  } else {
    const key = metric === "temp" ? "t" : "h";
    const live = Number(feed?.iaqi?.[key]?.v);
    if (Number.isFinite(live)) {
      byDate[todayUtcDate()] = Math.round(live * 100) / 100;
    }
  }

  const available = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  if (!available.length) {
    return {
      error: "no_sensor",
      message: "WAQI returned no usable daily values near this location.",
      points: [],
      source: "waqi",
    };
  }

  const inRange = available.filter((p) => p.date >= dateFrom && p.date <= dateTo);
  // If the class week doesn't overlap WAQI's window, still return recent points so the
  // Analysis UI can align them onto the student's dates by order.
  const points = inRange.length ? inRange : available;
  const dateMatch = inRange.length ? "exact" : "nearest_window";

  return {
    source: "waqi",
    metric,
    locationName,
    dateMatch,
    unitNote:
      metric === "pm25"
        ? "WAQI PM2.5 AQI converted to approx. µg/m³ (US EPA breakpoints)"
        : undefined,
    points,
  };
}

/**
 * Map pins for Heat Map when OpenAQ is empty (Hanoi / sparse cities).
 * Values are converted to µg/m³ for PM2.5.
 */
export async function fetchWaqiHeatmapPoints(opts) {
  const { token, lat, lng, metric: rawMetric, delta = 0.45 } = opts;
  const metric = normalizeMetric(rawMetric);
  if (!token) {
    return { error: "no_api_key", message: "WAQI_API_TOKEN is not set on the server." };
  }
  if (metric !== "pm25") {
    return {
      error: "unsupported_metric",
      message: "WAQI heatmap fallback currently supports pm25 only.",
      points: [],
    };
  }

  const lat0 = Number(lat);
  const lng0 = Number(lng);
  const latlng = [
    roundCoord(lat0 - delta),
    roundCoord(lng0 - delta),
    roundCoord(lat0 + delta),
    roundCoord(lng0 + delta),
  ].join(",");

  const stations = await waqiJson("/map/bounds/", token, { latlng });
  const list = Array.isArray(stations) ? stations : [];

  const points = list
    .map((station) => {
      const latNum = Number(station.lat);
      const lngNum = Number(station.lon);
      const aqi = Number(station.aqi);
      const ugm3 = aqiPm25ToUgm3(aqi);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || ugm3 == null) return null;
      return {
        latitude: roundCoord(latNum),
        longitude: roundCoord(lngNum),
        value: ugm3,
        point_count: 1,
        location_name: station.station?.name || null,
        sensor_id: station.uid || null,
      };
    })
    .filter(Boolean);

  return {
    source: "waqi",
    metric,
    cityCenter: { lat: roundCoord(lat0), lng: roundCoord(lng0) },
    points,
  };
}
