import { NextRequest, NextResponse } from "next/server";
import { appendMessage, getSession } from "@/lib/manibot-session";
import { ManiMessage } from "@/lib/manibot-session";

export async function POST(req: NextRequest) {
  const { id, sessionId, role, content } = await req.json();
  const message: ManiMessage = {
    id,
    sessionId,
    role,
    content,
    createdAt: Date.now(),
  } as any;
  await appendMessage(sessionId, message);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  return NextResponse.json(session?.messages ?? []);
}
