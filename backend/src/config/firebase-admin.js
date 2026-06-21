import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env.js";

let cachedApp = null;

/**
 * Lazily initialize the Firebase Admin app from service-account credentials in env.
 * Throws a clear error if not configured — auth depends on this, so failing loudly beats
 * silently rejecting every request later.
 *
 * Uses the modular firebase-admin/app + firebase-admin/auth subpath exports because the
 * package is CommonJS and the default `import admin from "firebase-admin"` does not reliably
 * expose `admin.credential` under ESM.
 */
export function getFirebaseAdmin() {
  if (cachedApp) return cachedApp;
  const { projectId, clientEmail, privateKey } = env.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }
  // Reuse an already-initialized app if one exists (e.g. server + module reloads in the same process).
  cachedApp = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return cachedApp;
}

/** Firebase Admin Auth service (verify ID tokens, manage users). */
export function firebaseAuth() {
  return getAuth(getFirebaseAdmin());
}
