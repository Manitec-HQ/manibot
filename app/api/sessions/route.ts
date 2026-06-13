import { NextRequest, NextResponse } from "next/server";
import { getAllSessions, upsertSession, deleteSession } from "@/lib/manibot-session";

export async function GET() {
  const sessions = await getAllSessions();
  // Return shape compatible with existing frontend: id + title + createdAt
  return NextResponse.json(
    sessions.map((s) => ({ id: s.id, title: s.title, created_at: new Date(s.createdAt).toISOString() }))
  );
}

export async function POST(req: NextRequest) {
  const { id, title } = await req.json();
  await upsertSession(id, title, []);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
