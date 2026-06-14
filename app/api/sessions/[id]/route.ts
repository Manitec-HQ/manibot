import { NextResponse } from 'next/server'
import { getSession, deleteSession } from '@/lib/manibot-session'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) return NextResponse.json([], { status: 200 })
  // Return messages in the same shape the frontend expects
  const messages = session.messages.map((m) => ({
    id: m.id,
    session_id: id,
    role: m.role,
    content: m.content,
    created_at: new Date(m.createdAt).toISOString(),
  }))
  return NextResponse.json(messages)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await deleteSession(id)
  return NextResponse.json({ ok: true })
}
