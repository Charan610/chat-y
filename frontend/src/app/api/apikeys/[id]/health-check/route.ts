import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // This route proxies health checks to provider APIs server-side,
  // avoiding CORS issues that occur when calling from the browser directly.

  try {
    const body = await req.json().catch(() => ({}));
    const { provider, api_key, base_url } = body;

    if (!provider || !api_key) {
      return NextResponse.json(
        { status: 'error', message: 'Missing provider or api_key in request body' },
        { status: 400 }
      );
    }

    let testUrl = '';
    const headers: Record<string, string> = {};

    if (provider === 'groq') {
      testUrl = 'https://api.groq.com/openai/v1/models';
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (provider === 'openai') {
      testUrl = 'https://api.openai.com/v1/models';
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (provider === 'nvidia_nim') {
      testUrl = (base_url || 'https://integrate.api.nvidia.com/v1') + '/models';
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (provider === 'anthropic') {
      testUrl = 'https://api.anthropic.com/v1/models';
      headers['x-api-key'] = api_key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'openrouter') {
      testUrl = 'https://openrouter.ai/api/v1/models';
      headers['Authorization'] = `Bearer ${api_key}`;
    } else {
      return NextResponse.json({ status: 'unknown', message: `Health check not supported for provider: ${provider}` });
    }

    const resp = await fetch(testUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      return NextResponse.json({ status: 'ok', message: 'Key is working', http_status: resp.status });
    } else {
      const errText = await resp.text().catch(() => '');
      return NextResponse.json({
        status: 'error',
        message: `Provider returned HTTP ${resp.status}${errText ? ': ' + errText.slice(0, 100) : ''}`,
        http_status: resp.status,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
