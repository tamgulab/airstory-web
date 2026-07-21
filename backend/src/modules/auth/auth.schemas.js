import { z } from "zod";

const normalizedEmail = z
  .string()
  .email()
  .transform((s) => s.trim().toLowerCase());

const inviteToken = z.string().trim().min(20).max(128);

// Password is owned by Firebase (set on the client at sign-up), so it is not part of this payload.
// The user's identity comes from the verified Firebase ID token sent in the Authorization header.
// Two modes: workspaceName (create a workspace, become its teacher) XOR inviteToken (join the
// inviting workspace with the invitation's role) — no standalone accounts.
export const registerSchema = z.object({
  body: z
    .object({
      email: normalizedEmail.optional(),
      fullName: z.string().min(2),
      workspaceName: z.string().trim().min(2).optional(),
      inviteToken: inviteToken.optional(),
    })
    .refine((b) => Boolean(b.workspaceName) !== Boolean(b.inviteToken), {
      message: "Provide exactly one of workspaceName (create a workspace) or inviteToken (join by invitation).",
    }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

// Login and self-service password changes are handled by the Firebase client SDK, so no
// loginSchema / changePasswordSchema is needed here. resetStudentPasswordSchema (teacher action) remains below.

export const createInvitationsSchema = z.object({
  body: z.object({
    emails: z.array(normalizedEmail).min(1).max(50),
    role: z.enum(["student", "teacher"]),
    period: z.string().max(16).optional().default(""), // students only; ignored for teachers
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const revokeInvitationSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({
    workspaceId: z.string().uuid(),
    invitationId: z.string().uuid(),
  }),
  query: z.object({}).passthrough(),
});

export const inviteTokenSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({
    token: inviteToken,
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

/** Teacher sets (or clears, with null) the school a class workspace belongs to. */
export const setWorkspaceSchoolSchema = z.object({
  body: z.object({
    schoolId: z.string().uuid().nullable(),
  }),
  params: z.object({
    workspaceId: z.string().uuid(),
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

/**
 * Signed-in user updates their global account profile (account_profiles) — identity that is the
 * same in every workspace. All fields optional so callers can patch one at a time; at least one
 * must be present so an empty PATCH is rejected.
 */
export const updateAccountProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().max(120).optional(),
      title: z.string().trim().max(80).optional(),
      bio: z.string().trim().max(500).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "Provide at least one field to update (displayName, title, or bio).",
    }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

/** Signed-in user updates their own row in user_profiles (school / class name / placement). */
export const updateMyProfileSchema = z.object({
  body: z.object({
    workspaceId: z.string().uuid(), // profiles are per-workspace
    schoolCode: z.string().max(64).optional(),
    instructor: z.string().max(160).optional(),
    period: z.string().max(16).optional(),
    groupCode: z.string().max(16).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});
