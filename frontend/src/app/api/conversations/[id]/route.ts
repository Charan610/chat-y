import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json().catch(() => ({}));
    if (prisma && prisma.chat) {
      const updated = await prisma.chat.update({
        where: { id },
        data: {
          title: body.title !== undefined ? body.title : undefined,
        },
      });
      return NextResponse.json({
        id: updated.id,
        title: updated.title,
        updated_at: updated.updatedAt.toISOString(),
      });
    }
  } catch {}

  return NextResponse.json({ id, ...await req.json().catch(() => ({})) });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    if (prisma && prisma.chat) {
      await prisma.chat.delete({ where: { id } });
    }
  } catch {}

  return new NextResponse(null, { status: 204 });
}
