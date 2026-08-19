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

    const normalizedProvider = String(provider).toLowerCase().replace('gemini', 'google').replace('claude', 'anthropic');
    const configuredBase = String(base_url || '').replace(/\/$/, '');
    if (normalizedProvider === 'groq') {
      testUrl = `${configuredBase || 'https://api.groq.com/openai/v1'}/models`;
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (normalizedProvider === 'openai') {
      testUrl = `${configuredBase || 'https://api.openai.com/v1'}/models`;
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (normalizedProvider === 'nvidia_nim') {
      testUrl = `${configuredBase || 'https://integrate.api.nvidia.com/v1'}/models`;
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (normalizedProvider === 'anthropic') {
      testUrl = `${configuredBase || 'https://api.anthropic.com/v1'}/models`;
      headers['x-api-key'] = api_key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (normalizedProvider === 'openrouter') {
      testUrl = `${configuredBase || 'https://openrouter.ai/api/v1'}/models`;
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (normalizedProvider === 'google') {
      testUrl = `${configuredBase || 'https://generativelanguage.googleapis.com/v1beta/openai'}/models`;
      headers['Authorization'] = `Bearer ${api_key}`;
    } else if (normalizedProvider === 'ollama') {
      testUrl = `${configuredBase || 'http://localhost:11434'}/api/tags`;
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
