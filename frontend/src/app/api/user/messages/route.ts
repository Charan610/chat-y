import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { chatId, role, content, provider } = await req.json();

    if (!chatId || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify chat belongs to logged-in user server-side
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        role,
        content,
        provider,
      },
    });

    // Touch chat updatedAt timestamp
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
