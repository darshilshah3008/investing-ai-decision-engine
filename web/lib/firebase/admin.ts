// Server-side Firebase admin SDK. Used by API routes to read/write
// the cached verdicts collection and to verify ID tokens for protected
// endpoints.
//
// Reads service-account credentials from FIREBASE_SERVICE_ACCOUNT_JSON
// (inline JSON string) — see .env.example.

import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function init(): App | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    // Allow the app to boot without admin credentials — endpoints that
    // need them will return a clear error rather than crashing the server.
    return null;
  }
  if (getApps().length) return getApps()[0]!;
  try {
    const sa = JSON.parse(json);
    return initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
    });
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err);
    return null;
  }
}

export function getAdmin() {
  if (adminApp) return { app: adminApp, db: adminDb!, auth: adminAuth! };
  const app = init();
  if (!app) return { app: null, db: null, auth: null };
  adminApp = app;
  adminDb = getFirestore(app);
  adminAuth = getAuth(app);
  return { app: adminApp, db: adminDb, auth: adminAuth };
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns the uid, or null if the token is missing/invalid.
 */
export async function verifyAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const { auth } = getAdmin();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
