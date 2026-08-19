import { NextResponse } from 'next/server';
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ...body, id: params.id });
}
export async function DELETE() { return new NextResponse(null, { status: 204 }); }
