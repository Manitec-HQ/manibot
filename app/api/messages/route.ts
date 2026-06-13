import { NextRequest, NextResponse } from "next/server";
import { appendMessage, getSession } from "@/lib/manibot-session";
import type { ManiMessage } from "@/lib/manibot-session";

export async function POST(req: NextRequest) {
  const body = await req.json() as { id: string; sessionId: string; role: string; content: string };
  const message: ManiMessage = {
    id: body.id,
    role: body.role as "user" | "assistant",
    content: body.content,
    createdAt: Date.now(),
  };
  await appendMessage(body.sessionId, message);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  return NextResponse.json(session?.messages ?? []);
}
