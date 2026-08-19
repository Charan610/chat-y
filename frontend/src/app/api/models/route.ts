import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Models are synchronized to localStorage by the client; this prevents Vercel 404s.
export async function GET() { return NextResponse.json([]); }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ...body, id: body.id || `model-${Date.now()}` }, { status: 201 });
}
