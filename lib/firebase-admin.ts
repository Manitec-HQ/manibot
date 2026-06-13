/**
 * firebase-admin.ts
 * Server-side Firebase Admin SDK for Manibot.
 * Used in API routes for Firestore reads/writes.
 * Requires env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let _app: App;
let _db: Firestore;

export function getFirebaseAdmin(): { app: App; db: Firestore } | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[manibot] Firebase Admin env vars not set — Firestore unavailable.");
    return null;
  }

  if (!_app) {
    _app = getApps().length
      ? getApps()[0]!
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  if (!_db) {
    _db = getFirestore(_app);
  }

  return { app: _app, db: _db };
}
