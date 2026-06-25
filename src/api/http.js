import { auth } from "../firebase";

// Backend mounts routes under `/api/...`. Paths in this file are like `/auth/me`.
// So the base must be `https://host/api` (NOT `https://host` alone), or every request 404s with "Not found".
function getDefaultApiBase() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  return isLocalhost
    ? "http://localhost:4000/api"
    : "https://air-sensor-api.onrender.com/api";
}

function normalizeApiBase(raw) {
  const fallback = getDefaultApiBase();
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  let u = (raw || fallback).trim().replace(/\/+$/, "");

  // Guardrail: if a localhost API URL is baked into a deployed build, ignore it.
  if (!isLocalhost && /localhost|127\.0\.0\.1/.test(u)) {
    u = fallback;
  }
  if (u.endsWith("/api")) return u;
  return `${u}/api`;
}
const API_BASE = normalizeApiBase(process.env.REACT_APP_API_BASE_URL);

/**
 * Current Firebase ID token, or null when signed out. The Firebase SDK caches and refreshes
 * this automatically, so getIdToken() returns a valid (≈1 hr) token without our own refresh logic.
 */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function apiRequest(path, options = {}) {
  const token = await getIdToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options, /** If no method is specified here, fetch defaults to GET */
      headers,
    });
  } catch (err) {
    const isNetwork =
      err instanceof TypeError ||
      String(err?.message || "")
        .toLowerCase()
        .includes("failed to fetch");
    if (isNetwork) {
      throw new Error(
        "Network error — API unreachable or blocked (check CORS / FRONTEND_URL on the server, or VPN)."
      );
    }
    throw err;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}
