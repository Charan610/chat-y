import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    if (prisma && prisma.message) {
      const messages = await prisma.message.findMany({
        where: { chatId: id },
        orderBy: { createdAt: 'asc' },
      });

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
  } catch (err) {
    console.warn('Database error fetching messages:', err);
  }

  return NextResponse.json([]);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json().catch(() => ({}));
    const role = body.role || 'user';
    const content = body.content || '';
    const provider = body.provider || 'cloud';

    if (prisma && prisma.message) {
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
