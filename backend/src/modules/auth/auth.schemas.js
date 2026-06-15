import { z } from "zod";

const joinCodePattern = /^[A-Z0-9]{5}$/;

const normalizedEmail = z
  .string()
  .email()
  .transform((s) => s.trim().toLowerCase());

// Password is owned by Firebase (set on the client at sign-up), so it is not part of this payload.
// The user's identity comes from the verified Firebase ID token sent in the Authorization header.
export const registerSchema = z.object({
  body: z.object({
    email: normalizedEmail,
    fullName: z.string().min(2),
    workspaceName: z.string().min(2).default("Default Workspace"),
    role: z.enum(["student", "teacher"]).optional().default("student"),
    schoolCode: z.string().optional().default(""),
    instructor: z.string().optional().default(""),
    period: z.string().optional().default(""),
    groupCode: z.string().optional().default(""),
    studentCode: z.string().optional().default(""),
    joinWorkspaceId: z.string().uuid().optional(),
    joinCode: z.string().trim().toUpperCase().regex(joinCodePattern, "Join code must be 5 letters/numbers.").optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

// Login and self-service password changes are handled by the Firebase client SDK, so no
// loginSchema / changePasswordSchema is needed here. resetStudentPasswordSchema (teacher action) remains below.

export const createJoinCodeSchema = z.object({
  body: z.object({
    code: z.string().trim().toUpperCase().regex(joinCodePattern, "Code must be 5 letters/numbers."),
    schoolCode: z.string().optional().default(""),
    instructor: z.string().optional().default(""),
    active: z.boolean().optional().default(true),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const toggleJoinCodeSchema = z.object({
  body: z.object({
    active: z.boolean(),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
    codeId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const resetStudentPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(8),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const updateStudentPlacementSchema = z.object({
  body: z.object({
    period: z.string().min(1),
    groupCode: z.string().min(1),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const removeStudentSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const updateClassStructureSchema = z.object({
  body: z.object({
    periodCount: z.number().int().min(1).max(12),
    groupCount: z.number().int().min(1).max(12),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const getJoinCodeConfigSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({
    code: z.string().trim().toUpperCase().regex(joinCodePattern, "Code must be 5 letters/numbers."),
  }),
  query: z.object({}).passthrough(),
});

/** Signed-in user updates their own row in user_profiles (school / class name / placement). */
export const updateMyProfileSchema = z.object({
  body: z.object({
    schoolCode: z.string().max(64).optional(),
    instructor: z.string().max(160).optional(),
    period: z.string().max(16).optional(),
    groupCode: z.string().max(16).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});
