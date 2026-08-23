import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';

  // 1. Try FastAPI backend SQLite
  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations${query}`, {
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
    if (prisma && prisma.chat) {
      const whereClause = userId ? { userId } : {};
      const chats = await prisma.chat.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            select: { id: true },
          },
        },
      });

      if (chats.length > 0) {
        const formatted = chats.map((c: any) => ({
          id: c.id,
          title: c.title,
          created_at: c.createdAt.toISOString(),
          updated_at: c.updatedAt.toISOString(),
          is_pinned: false,
          is_favorite: false,
          is_archived: false,
          model: c.model || 'groq/llama-3.3-70b-versatile',
          message_count: c.messages?.length || 0,
          total_tokens: 0,
        }));
        return NextResponse.json(formatted);
      }
    }
  } catch {}

  return NextResponse.json([]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title || 'New Conversation';
    const model = body.model || 'groq/llama-3.3-70b-versatile';
    const userId = body.user_id || 'usr_default';

    // 1. Forward to FastAPI backend SQLite
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          model,
          user_id: userId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
      }
    } catch {}

    // 2. Fallback to Prisma if available
    if (prisma && prisma.chat && prisma.user) {
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: { id: userId, name: userId },
        });

        const newChat = await prisma.chat.create({
          data: {
            userId,
            title,
            model,
          },
        });

        return NextResponse.json({
          id: newChat.id,
          title: newChat.title,
          created_at: newChat.createdAt.toISOString(),
          updated_at: newChat.updatedAt.toISOString(),
          is_pinned: false,
          is_favorite: false,
          is_archived: false,
          model: newChat.model,
          message_count: 0,
          total_tokens: 0,
        }, { status: 201 });
      } catch {}
    }

    const fallbackId = `conv-${Date.now()}`;
    return NextResponse.json({
      id: fallbackId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: false,
      is_favorite: false,
      is_archived: false,
      model,
      message_count: 0,
      total_tokens: 0,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: false,
      is_favorite: false,
      is_archived: false,
      model: 'groq/llama-3.3-70b-versatile',
      message_count: 0,
      total_tokens: 0,
    }, { status: 201 });
  }
}
