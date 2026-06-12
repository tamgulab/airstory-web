import { z } from "zod";

export const createSessionSchema = z.object({
  params: z.object({ workspaceId: z.string().uuid() }),
  query: z.object({}).passthrough(),
  body: z.object({
    sessionCode: z.string().min(1),
    name: z.string().min(1),
    notes: z.string().optional().default(""),
    locationName: z.string().optional().default(""),
    schoolCode: z.string().optional().default(""),
    instructor: z.string().optional().default(""),
    period: z.string().optional().default(""),
    groupCode: z.string().optional().default(""),
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    visibility: z.enum(['public', 'school', 'group']).optional().default('group'),
    ownerCode: z.string().optional().default(''),
  }),
});

export const createMeasurementSchema = z.object({
  params: z.object({ workspaceId: z.string().uuid() }),
  query: z.object({}).passthrough(),
  body: z.object({
    sessionId: z.string().uuid(),
    capturedAt: z.string().datetime(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    indoorOutdoor: z.enum(["INDOOR", "OUTDOOR"]).optional().nullable(),
    pm25: z.number(),
    co: z.number(),
    temp: z.number(),
    humidity: z.number(),
  }),
});

export const updateMeasurementSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid(),
    measurementId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
  body: z.object({
    pm25: z.number().optional(),
    co: z.number().optional(),
    temp: z.number().optional(),
    humidity: z.number().optional(),
    indoorOutdoor: z.enum(["INDOOR", "OUTDOOR"]).optional(),
  }),
});

export const addMeasurementEditSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid(),
    measurementId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
  body: z.object({
    fieldName: z.enum(["pm25", "co", "temp", "humidity"]),
    editedValue: z.number(),
    editNote: z.string().max(300).optional().default(""),
  }),
});

const indoorOutdoorImport = z.preprocess((val) => {
  const s = String(val ?? "OUTDOOR")
    .trim()
    .toUpperCase();
  if (s === "IN" || s === "INSIDE" || s === "INDOOR") return "INDOOR";
  return "OUTDOOR";
}, z.enum(["INDOOR", "OUTDOOR"]));

const importRowSchema = z.object({
  capturedAt: z.string().datetime(),
  sessionCode: z.string().min(1).optional().default("SESSION"),
  sessionName: z.string().min(1).optional().default("Imported Session"),
  sessionNotes: z.string().optional().default(""),
  location: z.string().optional().default("Imported Location"),
  school: z.string().optional().default(""),
  instructor: z.string().optional().default(""),
  period: z.string().optional().default(""),
  group: z.string().optional().default(""),
  indoorOutdoor: indoorOutdoorImport.optional().default("OUTDOOR"),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  pm25: z.number(),
  co: z.number(),
  temp: z.number(),
  humidity: z.number(),
  visibility: z.enum(['public', 'school', 'group']).optional().default('group'),
  ownerCode: z.string().optional().default('')
});

export const importCsvMeasurementsSchema = z.object({
  params: z.object({ workspaceId: z.string().uuid() }),
  query: z.object({}).passthrough(),
  body: z.object({
    rows: z.array(importRowSchema).min(1).max(10000),
  }),
});
