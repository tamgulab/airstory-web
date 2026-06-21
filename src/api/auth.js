import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updatePassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { apiRequest } from "./http";

export async function login(email, password) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  // Firebase verifies the credentials and starts the session; subsequent apiRequest calls
  // (e.g. getMe) attach the resulting ID token automatically.
  await signInWithEmailAndPassword(auth, normalizedEmail, password);
  return null;
}

/**
 * Sign in (or sign up) with Google via a popup. Returns the Firebase user so the caller can
 * pre-fill onboarding (name/email). Whether the user already has an app account is determined
 * separately by calling getMe(); first-time users get a 401 and are routed to onboarding.
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/**
 * Provision the app account (workspace / membership / profile) for a user who is ALREADY signed
 * in to Firebase (e.g. via Google). Unlike register(), this does not create a Firebase identity —
 * it only POSTs /auth/register with the existing ID token. On failure the caller stays signed in
 * to Firebase and can retry; we sign out rather than delete the federated account.
 */
export async function completeRegistration({
  email,
  fullName,
  workspaceName,
  role,
  schoolCode,
  instructor,
  period,
  groupCode,
  studentCode,
  joinWorkspaceId,
  joinCode,
}) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      fullName,
      workspaceName: workspaceName || "Default Workspace",
      role: role || "student",
      schoolCode: schoolCode || "",
      instructor: instructor || "",
      period: period || "",
      groupCode: groupCode || "",
      studentCode: studentCode || "",
      joinWorkspaceId,
      joinCode: joinCode || undefined,
    }),
  });
}

/** Changes the signed-in user's own Firebase password. `email` is a confirmation field. */
export async function changePassword(email, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to change your password.");
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (user.email && normalizedEmail && user.email.toLowerCase() !== normalizedEmail) {
    throw new Error("Email must match your signed-in account");
  }
  await updatePassword(user, newPassword);
}

export async function register({
  email,
  password,
  fullName,
  workspaceName,
  role,
  schoolCode,
  instructor,
  period,
  groupCode,
  studentCode,
  joinWorkspaceId,
  joinCode,
}) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  // Create the Firebase identity first, then provision the app account (workspace/profile/role).
  const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  try {
    return await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: normalizedEmail,
        fullName,
        workspaceName: workspaceName || "Default Workspace",
        role: role || "student",
        schoolCode: schoolCode || "",
        instructor: instructor || "",
        period: period || "",
        groupCode: groupCode || "",
        studentCode: studentCode || "",
        joinWorkspaceId,
        joinCode: joinCode || undefined,
      }),
    });
  } catch (err) {
    // Backend provisioning failed (e.g. invalid join code) — remove the orphaned Firebase
    // account so the email is free and the user can retry cleanly.
    try {
      await cred.user.delete();
    } catch {
      // If cleanup fails, surface the original error; the account can be reused on next sign-in.
    }
    throw err;
  }
}

export async function getMe() {
  return apiRequest("/auth/me");
}

/** Persist school code, class (instructor) name, period, group on the signed-in user's profile. */
export async function updateMyProfile({ schoolCode, instructor, period, groupCode } = {}) {
  const body = {};
  if (schoolCode !== undefined) body.schoolCode = schoolCode;
  if (instructor !== undefined) body.instructor = instructor;
  if (period !== undefined) body.period = period;
  if (groupCode !== undefined) body.groupCode = groupCode;
  return apiRequest("/auth/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getRoster(workspaceId) {
  return apiRequest(`/auth/workspaces/${workspaceId}/roster`);
}

export async function getJoinCodes(workspaceId) {
  return apiRequest(`/auth/workspaces/${workspaceId}/join-codes`);
}

export async function createJoinCode(workspaceId, body) {
  return apiRequest(`/auth/workspaces/${workspaceId}/join-codes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getJoinCodeConfig(code) {
  return apiRequest(`/auth/join-code/${encodeURIComponent(String(code || "").toUpperCase())}/config`);
}

export async function getClassStructure(workspaceId) {
  return apiRequest(`/auth/workspaces/${workspaceId}/class-structure`);
}

export async function updateClassStructure(workspaceId, body) {
  return apiRequest(`/auth/workspaces/${workspaceId}/class-structure`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function setJoinCodeActive(workspaceId, codeId, active) {
  return apiRequest(`/auth/workspaces/${workspaceId}/join-codes/${codeId}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function resetStudentPassword(workspaceId, userId, newPassword) {
  return apiRequest(`/auth/workspaces/${workspaceId}/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export async function updateStudentPlacement(workspaceId, userId, { period, groupCode }) {
  return apiRequest(`/auth/workspaces/${workspaceId}/users/${userId}/placement`, {
    method: "PATCH",
    body: JSON.stringify({ period, groupCode }),
  });
}

export async function removeStudent(workspaceId, userId) {
  return apiRequest(`/auth/workspaces/${workspaceId}/users/${userId}`, {
    method: "DELETE",
  });
}

export async function logout() {
  // Firebase clears the persisted session and stops refreshing the ID token.
  await signOut(auth);
}
