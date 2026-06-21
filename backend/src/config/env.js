import dotenv from "dotenv";

dotenv.config();

function parseOriginList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/**
 * Browser origins allowed when CORS is in allowlist mode.
 * Comma-separated FRONTEND_URL(s), e.g. "https://user.github.io,https://app.vercel.app"
 * Local dev hosts are always appended so local UI can hit prod API when needed.
 */
const localhostOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const configuredOrigins = parseOriginList(process.env.FRONTEND_URL);
export const frontendOrigins = [...new Set([...configuredOrigins, ...localhostOrigins])];

/** If no FRONTEND_URL is set, reflect request Origin so GitHub Pages/Vercel work without env churn. */
export const corsReflectOrigin = configuredOrigins.length === 0;

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  /** @deprecated use frontendOrigins / corsReflectOrigin for CORS */
  frontendUrl: configuredOrigins[0] || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  /**
   * Firebase Admin service-account credentials. Firebase is the identity provider:
   * the backend verifies ID tokens and manages user passwords through the Admin SDK.
   * FIREBASE_PRIVATE_KEY is stored with escaped newlines (\n) and unescaped here, same as GOOGLE_PRIVATE_KEY.
   */
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
  googleSheetId: process.env.GOOGLE_SHEET_ID || "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  /** OpenAQ v3 — keep in backend only; never commit (see backend/.env.example). */
  openaqApiKey: process.env.OPENAQ_API_KEY || "",
};

export function isProduction() {
  return env.nodeEnv === "production";
}
