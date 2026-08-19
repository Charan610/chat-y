import { NextResponse } from 'next/server';

// API credentials intentionally remain client-owned. This route exists so Vercel
// deployments do not 404; the browser remains the source of truth for keys.
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json([]); }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ...body, id: body.id || `key-${Date.now()}`, api_key_masked: body.api_key ? `${String(body.api_key).slice(0, 4)}****${String(body.api_key).slice(-4)}` : '****' }, { status: 201 });
}
