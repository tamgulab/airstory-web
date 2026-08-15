/** Shared mapping of API measurements → table rows + session-level grouping (Raw Data, workspace hydrate). */

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
    // One row per session, not per minute. A 90-second mobile recording crosses up to three
    // wall-clock minutes and used to split into three table rows even though the backend stored
    // it as a single session. The remaining fields still separate rows that genuinely differ.
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
    ].join("|");

    if (!byChunk.has(key)) {
      byChunk.set(key, {
        ...row,
        id: `chunk-${row.id}`,
        // Placeholders; the real values come from startedAt once every reading has been seen.
        // They cannot be taken from the first row encountered: the API returns captured_at DESC,
        // so that row is the session's LAST reading, not its first.
        date: "",
        time: "",
        capturedAt: "",
        startedAt: captured.getTime(),
        endedAt: captured.getTime(),
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
    agg.startedAt = Math.min(agg.startedAt, captured.getTime());
    agg.endedAt = Math.max(agg.endedAt, captured.getTime());
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
      // Sort key. `time` is only HH:MM:SS, so ordering by it breaks for a session spanning
      // midnight; an ISO instant orders correctly and sorts lexically.
      capturedAt: captured.toISOString(),
      pm25: Number(row.pm25) || 0,
      co: Number((Number(row.co) || 0).toFixed(2)),
      temp: Number(row.temp) || 0,
      humidity: Number(row.humidity) || 0,
    });
  });

  return Array.from(byChunk.values())
    .map((agg) => {
      // The row is stamped with when the session STARTED, which is what a reader looks for in a
      // session list. Previously this was the truncated minute of whichever reading happened to
      // be encountered first.
      const start = new Date(agg.startedAt);
      return {
        ...agg,
        date: start.toISOString().split("T")[0],
        time: start.toTimeString().slice(0, 5),
        capturedAt: start.toISOString(),
        // Headline values are MEANS over every reading in the session (unchanged arithmetic —
        // only the set being averaged is now the session rather than one minute). A mean is right
        // here because the row summarises a whole recording: a max would misreport a steady
        // session as its worst instant, and the first reading is arbitrary. The per-reading
        // values, including any peak, remain visible on expand.
        pm25: Math.round(agg.pm25Sum / Math.max(agg.count, 1)),
        co: (agg.coSum / Math.max(agg.count, 1)).toFixed(2),
        temp: Math.round(agg.tempSum / Math.max(agg.count, 1)),
        humidity: Math.round(agg.humiditySum / Math.max(agg.count, 1)),
        detailedData: agg.detailedData
          .slice()
          .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
      };
    })
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
}

/**
 * How many individual readings a grouped row stands for.
 *
 * Since rows are grouped per session, an unweighted mean across rows would treat a 40-reading
 * session and a 3-reading session as equally informative. Analysis / Heat Map / Workspace weight
 * their means by this so they average at reading level.
 *
 * Falls back to 1 for anything without a count — OpenAQ reference points, legacy cache entries —
 * so a mixed pool degrades to the previous unweighted behaviour rather than dropping rows.
 */
export function readingWeight(row) {
  const n = Number(row?.count);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function workspaceMeasurementsToDisplayRows(measurements) {
  const filtered = filterNonDemoMeasurements(measurements);
  const flat = mapApiMeasurementsToFlatRows(filtered);
  return groupMeasurementRowsForDisplay(flat);
}

// Visibility ('public' | 'school') is now enforced server-side by the kind-aware read queries
// (class / school / public workspaces), so there is no client-side visibility predicate here.
