const IMPORTED_MEASUREMENTS_KEY = "air_imported_measurements_v1";
/** sessionStorage: 'local-import' | 'server' — blocks poll/reload from wiping a CSV the user just loaded. */
const IMPORTED_MEASUREMENTS_SOURCE_KEY = "air_imported_measurements_source_v1";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function getMappedValue(record, keys, fallback = "") {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return fallback;
}

export function normalizeIndoorOutdoor(value) {
  const s = String(value ?? "OUTDOOR")
    .trim()
    .toUpperCase();
  if (s === "IN" || s === "INSIDE" || s === "INDOOR") return "INDOOR";
  return "OUTDOOR";
}

/** True if CSV/class field is missing — should not force-hide rows when global filters are set. */
export function isBlankHierarchyField(value) {
  return !String(value ?? "").trim();
}

/**
 * If all imported rows share one school/period/group/etc., return it; otherwise '' (show all).
 * Aligns Raw Data / global filters with the CSV so profile (e.g. G1) does not hide G4 upload.
 */
export function uniqueHierarchyFromImportedRows(rows) {
  const out = { school: "", instructor: "", period: "", group: "" };
  if (!Array.isArray(rows) || !rows.length) return out;
  const keys = ["school", "instructor", "period", "group"];
  for (const k of keys) {
    const vals = [
      ...new Set(rows.map((r) => String(r[k] ?? "").trim()).filter(Boolean)),
    ];
    out[k] = vals.length === 1 ? vals[0] : "";
  }
  return out;
}

export function setImportedMeasurements(data, { source = "server" } = {}) {
  const payload = JSON.stringify(data || []);
  try {
    localStorage.setItem(IMPORTED_MEASUREMENTS_KEY, payload);
  } catch (err) {
    // Quota / private mode — never leave callers thinking the cache was replaced.
    console.warn("Failed to persist measurement cache", err);
    return false;
  }
  try {
    sessionStorage.setItem(IMPORTED_MEASUREMENTS_SOURCE_KEY, source);
  } catch {
    // sessionStorage may be unavailable; localStorage write still succeeded.
  }
  return true;
}

export function getImportedMeasurements() {
  const raw = localStorage.getItem(IMPORTED_MEASUREMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** True while the browser cache is a user CSV import that has not been confirmed from the API. */
export function isLocalImportCache() {
  try {
    return sessionStorage.getItem(IMPORTED_MEASUREMENTS_SOURCE_KEY) === "local-import";
  } catch {
    return false;
  }
}

export function clearImportedMeasurements() {
  localStorage.removeItem(IMPORTED_MEASUREMENTS_KEY);
  try {
    sessionStorage.removeItem(IMPORTED_MEASUREMENTS_SOURCE_KEY);
  } catch {
    // ignore
  }
}

export function parseImportedCsvRaw(csvText) {
  const lines = String(csvText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);
  const rawRows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record = {};
    headers.forEach((header, i) => {
      record[header] = values[i] ?? "";
    });

    const date = getMappedValue(record, ["date"], "");
    const time = getMappedValue(record, ["time"], "");
    const timestamp = getMappedValue(record, ["timestamp"], "");
    const parsedDate = timestamp
      ? new Date(timestamp)
      : new Date(`${date || "1970-01-01"}T${time || "00:00"}`);

    if (Number.isNaN(parsedDate.getTime())) continue;

    const item = {
      id: `csv-${lineIndex}-${parsedDate.getTime()}`,
      date: parsedDate.toISOString().split("T")[0],
      time: parsedDate.toTimeString().slice(0, 8),
      sessionId: getMappedValue(record, ["sessionid", "sessioncode"], "SESSION"),
      sessionName: getMappedValue(record, ["sessionname", "session"], "Imported Session"),
      sessionNotes: getMappedValue(record, ["notes", "sessionnotes"], ""),
      location: getMappedValue(record, ["location"], "Imported Location"),
      latitude: (() => {
        const raw = getMappedValue(record, ["latitude", "lat"], "");
        if (raw === "" || raw == null) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      })(),
      longitude: (() => {
        const raw = getMappedValue(record, ["longitude", "lng", "lon"], "");
        if (raw === "" || raw == null) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      })(),
      indoorOutdoor: normalizeIndoorOutdoor(getMappedValue(record, ["indooroutdoor"], "OUTDOOR")),
      school: getMappedValue(record, ["school", "schoolcode"], ""),
      instructor: getMappedValue(record, ["classinstructor", "class", "instructor"], ""),
      period: getMappedValue(record, ["period"], ""),
      group: getMappedValue(record, ["group", "groupcode"], ""),
      pm25: Number(getMappedValue(record, ["pm25"], "0")) || 0,
      co: Number(getMappedValue(record, ["co"], "0")) || 0,
      temp: Number(getMappedValue(record, ["temperature", "temp"], "0")) || 0,
      humidity: Number(getMappedValue(record, ["humidity"], "0")) || 0,
      photos: [],
      edits: {},
      source: "csv",
      capturedAt: parsedDate.toISOString(),
    };

    rawRows.push(item);
  }

  if (!rawRows.length) {
    throw new Error("No valid data rows found in CSV.");
  }

  return rawRows.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
}

export function parseImportedCsv(csvText) {
  const rawRows = parseImportedCsvRaw(csvText);
  // Collapse second-level sensor rows into minute-level chunks that can be expanded in the table.
  const byChunk = new Map();
  rawRows.forEach((row) => {
    const captured = new Date(row.capturedAt);
    const minuteBucket = new Date(captured);
    minuteBucket.setSeconds(0, 0);
    const minuteKey = minuteBucket.toISOString();

    const key = [
      row.sessionId,
      row.location,
      row.latitude,
      row.longitude,
      row.school,
      row.instructor,
      row.period,
      row.group,
      row.indoorOutdoor,
      minuteKey,
    ].join("|");

    if (!byChunk.has(key)) {
      byChunk.set(key, {
        id: `csv-chunk-${row.id}`,
        date: minuteBucket.toISOString().split("T")[0],
        time: minuteBucket.toTimeString().slice(0, 5),
        sessionId: row.sessionId,
        sessionName: row.sessionName,
        sessionNotes: row.sessionNotes,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        indoorOutdoor: row.indoorOutdoor,
        school: row.school,
        instructor: row.instructor,
        period: row.period,
        group: row.group,
        photos: row.photos || [],
        edits: row.edits || {},
        source: "csv",
        capturedAt: minuteBucket.toISOString(),
        count: 0,
        pm25Sum: 0,
        coSum: 0,
        tempSum: 0,
        humiditySum: 0,
        detailedData: [],
      });
    }

    const agg = byChunk.get(key);
    agg.count += 1;
    agg.pm25Sum += Number(row.pm25) || 0;
    agg.coSum += Number(row.co) || 0;
    agg.tempSum += Number(row.temp) || 0;
    agg.humiditySum += Number(row.humidity) || 0;
    agg.detailedData.push({
      id: row.id,
      time: captured.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      pm25: Number(row.pm25) || 0,
      co: Number((Number(row.co) || 0).toFixed(2)),
      temp: Number(row.temp) || 0,
      humidity: Number(row.humidity) || 0,
    });
  });

  const rows = Array.from(byChunk.values()).map((agg) => ({
    id: agg.id,
    date: agg.date,
    time: agg.time,
    sessionId: agg.sessionId,
    sessionName: agg.sessionName,
    sessionNotes: agg.sessionNotes,
    location: agg.location,
    latitude: agg.latitude,
    longitude: agg.longitude,
    indoorOutdoor: agg.indoorOutdoor,
    school: agg.school,
    instructor: agg.instructor,
    period: agg.period,
    group: agg.group,
    pm25: Math.round(agg.pm25Sum / Math.max(agg.count, 1)),
    co: (agg.coSum / Math.max(agg.count, 1)).toFixed(2),
    temp: Math.round(agg.tempSum / Math.max(agg.count, 1)),
    humidity: Math.round(agg.humiditySum / Math.max(agg.count, 1)),
    photos: agg.photos,
    edits: agg.edits,
    source: agg.source,
    capturedAt: agg.capturedAt,
    detailedData: agg.detailedData.sort((a, b) => a.time.localeCompare(b.time)),
  }));

  return rows.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
}
