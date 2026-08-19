import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const defaults: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  nvidia_nim: 'https://integrate.api.nvidia.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434',
};

function normalizeProvider(value: string) {
  const p = value.toLowerCase().trim();
  if (p === 'gemini') return 'google';
  if (p === 'claude') return 'anthropic';
  if (p === 'nvidia' || p === 'nim') return 'nvidia_nim';
  return p;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function POST(req: Request) {
  try {
    const { provider: rawProvider, api_key, base_url } = await req.json();
    if (!rawProvider || !api_key) return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 });
    const provider = normalizeProvider(rawProvider);
    const base = (base_url || defaults[provider] || '').replace(/\/$/, '');
    if (!base) return NextResponse.json({ error: `No endpoint configured for ${provider}` }, { status: 400 });

    const headers: Record<string, string> = { Accept: 'application/json' };
    let url = joinUrl(base, '/models');
    if (provider === 'anthropic') {
      headers['x-api-key'] = api_key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'ollama') {
      url = joinUrl(base, '/api/tags');
    } else {
      headers.Authorization = `Bearer ${api_key}`;
    }

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const raw = await response.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) {
      return NextResponse.json({ error: `Provider returned HTTP ${response.status}: ${raw.slice(0, 180)}` }, { status: response.status });
    }

    const items = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
    const models = items
      .map((item: any) => {
        const id = typeof item === 'string' ? item : item.id || item.name || item.model;
        if (!id) return null;
        return { id, name: item.name || id, provider, description: item.owned_by ? `Owned by ${item.owned_by}` : 'Discovered from provider API' };
      })
      .filter(Boolean)
      .filter((model: any) => !/embedding|moderation|whisper|tts|image|rerank/i.test(model.id));

    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
