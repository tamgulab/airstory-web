/** Shared mapping of API measurements → table rows + minute-level grouping (Raw Data, workspace hydrate). */

export function filterNonDemoMeasurements(measurements = []) {
  return measurements.filter((m) => {
    const code = String(m.session_code || "").toUpperCase();
    const name = String(m.session_name || "").toUpperCase();
    return !code.startsWith("DEMO-") && !name.includes("CAMPUS WALK GROUP");
  });
}

export function mapApiMeasurementsToFlatRows(measurements) {
  return measurements.map((m) => ({
    id: m.id,
    date: new Date(m.captured_at).toISOString().split("T")[0],
    time: new Date(m.captured_at).toTimeString().slice(0, 8),
    sessionId: m.session_id || m.session_code || "SESSION",
    sessionName: m.session_name || m.session_code || "Session",
    sessionNotes: m.session_notes || "",
    location: m.location_name || "Unknown",
    visibility: m.visibility || 'school',
    ownerCode: m.owner_student_code || '',
    latitude:
      m.latitude != null && m.latitude !== ""
        ? (Number.isFinite(Number(m.latitude)) ? Number(m.latitude) : null)
        : null,
    longitude:
      m.longitude != null && m.longitude !== ""
        ? (Number.isFinite(Number(m.longitude)) ? Number(m.longitude) : null)
        : null,
    indoorOutdoor: m.indoor_outdoor || "OUTDOOR",
    school: m.school_code || "",
    instructor: m.instructor || "",
    period: m.period || "",
    group: m.group_code || "",
    pm25: Number(m.edits?.pm25?.editedValue ?? m.pm25 ?? 0),
    co: Number(m.edits?.co?.editedValue ?? m.co ?? 0).toFixed(2),
    temp: Number(m.edits?.temp?.editedValue ?? m.temp ?? 0),
    humidity: Number(m.edits?.humidity?.editedValue ?? m.humidity ?? 0),
    photos: [],
    edits: m.edits || {},
    capturedAt: new Date(m.captured_at).toISOString(),
  }));
}

export function groupMeasurementRowsForDisplay(rows) {
  const byChunk = new Map();
  rows.forEach((row) => {
    const captured = row.capturedAt ? new Date(row.capturedAt) : new Date(`${row.date}T${row.time || "00:00"}`);
    if (Number.isNaN(captured.getTime())) return;
    const minuteBucket = new Date(captured);
    minuteBucket.setSeconds(0, 0);
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
      minuteBucket.toISOString(),
    ].join("|");

    if (!byChunk.has(key)) {
      byChunk.set(key, {
        ...row,
        id: `chunk-${row.id}`,
        date: minuteBucket.toISOString().split("T")[0],
        time: minuteBucket.toTimeString().slice(0, 5),
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

  return Array.from(byChunk.values())
    .map((agg) => ({
      ...agg,
      pm25: Math.round(agg.pm25Sum / Math.max(agg.count, 1)),
      co: (agg.coSum / Math.max(agg.count, 1)).toFixed(2),
      temp: Math.round(agg.tempSum / Math.max(agg.count, 1)),
      humidity: Math.round(agg.humiditySum / Math.max(agg.count, 1)),
      detailedData: agg.detailedData.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
}

export function workspaceMeasurementsToDisplayRows(measurements) {
  const filtered = filterNonDemoMeasurements(measurements);
  const flat = mapApiMeasurementsToFlatRows(filtered);
  return groupMeasurementRowsForDisplay(flat);
}

// Visibility ('public' | 'school') is now enforced server-side by the kind-aware read queries
// (class / school / public workspaces), so there is no client-side visibility predicate here.
