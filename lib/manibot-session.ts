/**
 * manibot-session.ts
 * Firestore persistence for Manibot sessions + messages.
 *
 * Schema:
 *   manibot/sessions/{sessionId}  {
 *     id:         string
 *     title:      string
 *     messages:   ManiMessage[]   (capped at 200)
 *     updatedAt:  Firestore server timestamp
 *     createdAt:  Firestore server timestamp (set on create only)
 *   }
 *
 * No uid — Manibot uses a shared gate password, not per-user auth.
 * Sessions are keyed by sessionId (nanoid, stored in localStorage).
 */

import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const SESSIONS_COLLECTION = "manibot/sessions" as const;
const MESSAGE_CAP = 200;

export interface ManiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number; // unix ms
}

export interface ManiSession {
  id: string;
  title: string;
  messages: ManiMessage[];
  updatedAt: number;
  createdAt: number;
}

function sessionsCol() {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  // Path: manibot (doc) -> sessions (subcollection)
  // Using a top-level collection pattern: manibot_sessions/{sessionId}
  return admin.db.collection("manibot_sessions");
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string): Promise<ManiSession | null> {
  const col = sessionsCol();
  if (!col) return null;
  const snap = await col.doc(sessionId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: d.id,
    title: d.title,
    messages: d.messages ?? [],
    updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
  };
}

export async function getAllSessions(): Promise<ManiSession[]> {
  const col = sessionsCol();
  if (!col) return [];
  const snap = await col.orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id,
      title: data.title,
      messages: data.messages ?? [],
      updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
      createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    };
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function upsertSession(
  sessionId: string,
  title: string,
  messages: ManiMessage[]
): Promise<void> {
  const col = sessionsCol();
  if (!col) return;
  const ref = col.doc(sessionId);
  const snap = await ref.get();
  const capped = messages.slice(-MESSAGE_CAP);

  if (!snap.exists) {
    await ref.set({
      id: sessionId,
      title,
      messages: capped,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set(
      { title, messages: capped, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
}

export async function appendMessage(
  sessionId: string,
  message: ManiMessage
): Promise<void> {
  const col = sessionsCol();
  if (!col) return;
  const ref = col.doc(sessionId);
  const snap = await ref.get();

  if (!snap.exists) {
    // Session doesn't exist yet — create it with this message
    await ref.set({
      id: sessionId,
      title: message.content.slice(0, 60),
      messages: [message],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const existing: ManiMessage[] = snap.data()!.messages ?? [];
  const updated = [...existing, message].slice(-MESSAGE_CAP);
  await ref.update({ messages: updated, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const col = sessionsCol();
  if (!col) return;
  await col.doc(sessionId).delete();
}
