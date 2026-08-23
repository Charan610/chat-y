import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  // 1. Try FastAPI backend SQLite
  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations/${id}/messages`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch {}

  // 2. Try Prisma PostgreSQL
  try {
    if (prisma && prisma.message) {
      const messages = await prisma.message.findMany({
        where: { chatId: id },
        orderBy: { createdAt: 'asc' },
      });

      if (messages.length > 0) {
        const formatted = messages.map((m: any) => ({
          id: m.id,
          conversation_id: m.chatId,
          role: m.role,
          content: m.content,
          provider: m.provider || 'cloud',
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          latency_ms: 0,
          estimated_cost: 0,
          created_at: m.createdAt.toISOString(),
          is_pinned: false,
        }));
        return NextResponse.json(formatted);
      }
    }
  } catch {}

  return NextResponse.json([]);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json().catch(() => ({}));
    const role = body.role || 'user';
    const content = body.content || '';
    const provider = body.provider || 'cloud';

    // 1. Forward to FastAPI backend SQLite
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          provider,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
      }
    } catch {}

    // 2. Fallback to Prisma if available
    if (prisma && prisma.message) {
      try {
        const created = await prisma.message.create({
          data: {
            chatId: id,
            role,
            content,
            provider,
          },
        });

        return NextResponse.json({
          id: created.id,
          conversation_id: created.chatId,
          role: created.role,
          content: created.content,
          provider: created.provider,
          created_at: created.createdAt.toISOString(),
        }, { status: 201 });
      } catch {}
    }
  } catch (err) {
    console.warn('Error saving message to database:', err);
  }

  return NextResponse.json({
    id: `msg-${Date.now()}`,
    conversation_id: id,
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
  }, { status: 201 });
}
