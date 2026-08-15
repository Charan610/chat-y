import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, name, email } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    if (prisma && prisma.user) {
      await prisma.user.upsert({
        where: { id },
        update: {
          name: name || undefined,
          email: email || undefined,
        },
        create: {
          id,
          name: name || 'User',
          email: email || `${id}@workspace.local`,
        },
      });
    }

    return NextResponse.json({ success: true, user: { id, name, email } });
  } catch (err) {
    return NextResponse.json({ success: true });
  }
}
