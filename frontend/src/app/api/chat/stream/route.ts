import { NextResponse } from 'next/server';
import { webSearch } from '@/lib/webSearch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Server-side streaming chat proxy — avoids CORS issues by calling provider
// APIs from the Next.js server instead of the browser.

function normalizeProvider(p: string): string {
  const clean = p.toLowerCase().trim();
  if (clean === 'nvidia' || clean === 'nvidia_nim' || clean === 'nim') return 'nvidia_nim';
  if (clean === 'google' || clean === 'gemini') return 'google';
  if (clean === 'anthropic' || clean === 'claude') return 'anthropic';
  return clean;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      messages: clientMessages = [],
      model: modelStr = 'groq/llama-3.3-70b-versatile',
      conversation_id,
      web_search,
      api_keys,
      api_configs,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // ── Resolve API keys ──────────────────────────────────────────────────
    let keys: Record<string, string> = {};
    if (api_keys && typeof api_keys === 'object') {
      for (const [k, v] of Object.entries(api_keys)) {
        if (k && v && typeof v === 'string') {
          const normKey = normalizeProvider(k);
          keys[normKey] = v;
          keys[k.toLowerCase()] = v;
        }
      }
    }

    // ── Resolve provider + model ──────────────────────────────────────────
    let provider = 'groq';
    let rawModelId = modelStr;

    if (modelStr.startsWith('openrouter/')) {
      provider = 'openrouter';
      rawModelId = modelStr.slice('openrouter/'.length);
    } else if (modelStr.startsWith('deepseek/') || modelStr.startsWith('deepseek-') || modelStr.includes('deepseek')) {
      provider = 'openrouter';
      rawModelId = modelStr.startsWith('openrouter/') ? modelStr.slice('openrouter/'.length) : (modelStr.includes('/') ? modelStr : `deepseek/${modelStr}`);
    } else if (modelStr.includes('/')) {
      const parts = modelStr.split('/');
      provider = normalizeProvider(parts[0]);
      rawModelId = parts.slice(1).join('/');
    } else if (modelStr.startsWith('gpt-') || modelStr.startsWith('o1') || modelStr.startsWith('o3')) {
      provider = 'openai';
    } else if (modelStr.startsWith('claude-')) {
      provider = 'anthropic';
    } else if (modelStr.startsWith('gemini-') || modelStr.startsWith('gemini/')) {
      provider = 'google';
    } else if (modelStr.startsWith('llama-') || modelStr.startsWith('mixtral-') || modelStr.startsWith('gemma')) {
      provider = 'groq';
    }

    const config = api_configs?.[provider] || api_configs?.[normalizeProvider(provider)];
    let apiKey = config?.api_key || keys[provider] || keys[normalizeProvider(provider)];
    let activeProvider = provider;

    // Fallback to any available key
    if (!apiKey) {
      if (keys['openrouter']) { activeProvider = 'openrouter'; apiKey = keys['openrouter']; rawModelId = 'meta-llama/llama-3.3-70b-instruct'; }
      else if (keys['groq']) { activeProvider = 'groq'; apiKey = keys['groq']; rawModelId = 'llama-3.3-70b-versatile'; }
      else if (keys['openai']) { activeProvider = 'openai'; apiKey = keys['openai']; rawModelId = 'gpt-4o-mini'; }
      else if (keys['google']) { activeProvider = 'google'; apiKey = keys['google']; rawModelId = 'gemini-1.5-flash'; }
      else if (keys['nvidia_nim']) { activeProvider = 'nvidia_nim'; apiKey = keys['nvidia_nim']; rawModelId = 'meta/llama-3.1-70b-instruct'; }
      else if (keys['anthropic']) { activeProvider = 'anthropic'; apiKey = keys['anthropic']; rawModelId = 'claude-3-5-haiku-20241022'; }
    }

    if (!apiKey) {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', error: `No active API key found for ${activeProvider}. Please enter your ${activeProvider.toUpperCase()} API key in Settings (⚙️) or choose a free in-browser WebLLM model.` })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } }
      );
    }

    // ── Build provider endpoint ───────────────────────────────────────────
    let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    let isAnthropic = false;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (activeProvider === 'groq') {
      endpoint = `${(config?.base_url || 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      rawModelId = rawModelId.replace(/^groq\//, '');
      if (rawModelId === 'llama-3.2-3b-preview' || rawModelId === 'llama-3.2-1b-preview' || rawModelId === 'llama3-70b-8192') {
        rawModelId = 'llama-3.1-8b-instant';
      }
    } else if (activeProvider === 'openai') {
      endpoint = `${(config?.base_url || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      rawModelId = rawModelId.replace(/^openai\//, '');
    } else if (activeProvider === 'google') {
      endpoint = `${(config?.base_url || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      rawModelId = rawModelId.replace(/^(google\/|gemini\/)+/, '');
      if (!rawModelId.startsWith('gemini-')) {
        rawModelId = `gemini-${rawModelId}`;
      }
    } else if (activeProvider === 'nvidia_nim') {
      endpoint = `${(config?.base_url || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      rawModelId = rawModelId.replace(/^nvidia_nim\//, '');
      if (!rawModelId.includes('/')) {
        if (rawModelId.startsWith('llama') || rawModelId.startsWith('meta')) {
          rawModelId = `meta/${rawModelId}`;
        } else {
          rawModelId = `nvidia/${rawModelId}`;
        }
      }
    } else if (activeProvider === 'openrouter') {
      endpoint = `${(config?.base_url || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://chat-y.local';
      headers['X-Title'] = 'Chat-Y';
      rawModelId = rawModelId.replace(/^openrouter\//, '');
      if (web_search && !rawModelId.endsWith(':online')) {
        rawModelId = `${rawModelId}:online`;
      }
    } else if (activeProvider === 'anthropic') {
      endpoint = `${(config?.base_url || 'https://api.anthropic.com/v1').replace(/\/$/, '')}/messages`;
      isAnthropic = true;
      delete headers['Content-Type'];
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers.Accept = 'text/event-stream';
      rawModelId = rawModelId.replace(/^anthropic\//, '');
    } else if (activeProvider === 'ollama') {
      endpoint = `${(config?.base_url || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`;
      rawModelId = rawModelId.replace(/^ollama\//, '');
    }

    // ── Web search augmentation ───────────────────────────────────────────
    let extraPrompt = '';
    const isTemporalQuery = web_search || /\b(today|latest|recent|news|current|who won|score|weather|this week|2026|right now|now|happened|price|stock)\b/i.test(message);

    if (isTemporalQuery) {
      try {
        const searchResults = await webSearch(message, 5);
        if (searchResults && searchResults.length > 0) {
          const formattedResults = searchResults
            .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
            .join('\n\n');
          extraPrompt = `\n\n--- REAL-TIME WEB SEARCH RESULTS ---\n${formattedResults}\n\nINSTRUCTIONS: Answer the user's question using the real-time web search results above. Cite sources using markdown links like [1](URL), [2](URL).`;
        }
      } catch (searchErr) {
        console.warn('Search integration error:', searchErr);
      }
    }

    // ── Build messages ────────────────────────────────────────────────────
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const systemPromptText = `Current Date: ${todayStr}. You are Chat-Y, an up-to-date, intelligent AI assistant. Always provide accurate, current, and real-time answers.`;

    // Clean and normalize history messages
    const historyMessages: { role: string; content: string }[] = [];
    if (Array.isArray(clientMessages)) {
      for (const m of clientMessages) {
        if (m && typeof m.content === 'string' && m.content.trim()) {
          const role = (m.role === 'assistant' || m.role === 'system') ? m.role : 'user';
          historyMessages.push({ role, content: m.content });
        }
      }
    }

    const currentTurnContent = message + extraPrompt;
    let providerBody: any;

    if (isAnthropic) {
      // Anthropic messages must alternate user / assistant, and system prompt is a top-level param
      const anthropicMsgs: { role: 'user' | 'assistant'; content: string }[] = [];
      for (const m of historyMessages) {
        if (m.role === 'system') continue;
        const role = m.role as 'user' | 'assistant';
        const lastMsg = anthropicMsgs[anthropicMsgs.length - 1];
        if (lastMsg && lastMsg.role === role) {
          lastMsg.content += `\n\n${m.content}`;
        } else {
          anthropicMsgs.push({ role, content: m.content });
        }
      }

      // Append or update current user message
      const last = anthropicMsgs[anthropicMsgs.length - 1];
      if (last && last.role === 'user') {
        last.content = currentTurnContent;
      } else {
        anthropicMsgs.push({ role: 'user', content: currentTurnContent });
      }

      // Ensure first message is user
      if (anthropicMsgs.length > 0 && anthropicMsgs[0].role !== 'user') {
        anthropicMsgs.unshift({ role: 'user', content: 'Hello' });
      }

      providerBody = {
        model: rawModelId,
        max_tokens: 4096,
        system: systemPromptText,
        messages: anthropicMsgs,
        stream: true,
      };

      console.log(`[Chat Stream Proxy] Sending ${anthropicMsgs.length} messages to Anthropic (${rawModelId}) for conv: ${conversation_id || 'new'}`);
    } else {
      // Standard OpenAI / Groq / Google Gemini / NVIDIA NIM / OpenRouter / Ollama format
      const formattedMsgs: { role: string; content: string }[] = [
        { role: 'system', content: systemPromptText }
      ];

      for (const m of historyMessages) {
        if (m.role === 'system') continue;
        formattedMsgs.push({ role: m.role, content: m.content });
      }

      // Append current user turn if not already the last turn or update content
      const lastMsg = formattedMsgs[formattedMsgs.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg.content = currentTurnContent;
      } else {
        formattedMsgs.push({ role: 'user', content: currentTurnContent });
      }

      providerBody = {
        model: rawModelId,
        messages: formattedMsgs,
        stream: true,
        temperature: 0.7,
        ...(activeProvider === 'ollama' ? { stream: true } : {}),
      };

      console.log(`[Chat Stream Proxy] Sending ${formattedMsgs.length} messages to ${activeProvider} (${rawModelId}) for conv: ${conversation_id || 'new'}`);
    }

    // ── Call provider API (server-side, no CORS issues) ───────────────────
    const providerRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(providerBody),
    });

    if (!providerRes.ok) {
      const errText = await providerRes.text().catch(() => '');
      let errorMsg = `Provider error (${providerRes.status}): ${errText.slice(0, 200)}`;
      if (providerRes.status === 401 || providerRes.status === 403) {
        errorMsg = `Authentication failed: The ${activeProvider.toUpperCase()} API key is invalid or expired. Please check your key in Settings (⚙️) or select another model.`;
      }
      return new Response(
        `data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } }
      );
    }

    // ── Stream the response through ───────────────────────────────────────
    const convId = conversation_id || `conv-${Date.now()}`;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata first
        const metadataChunk = JSON.stringify({
          type: 'metadata',
          model: rawModelId,
          provider: activeProvider,
          conversation_id: convId,
        });
        controller.enqueue(encoder.encode(`data: ${metadataChunk}\n\n`));

        // Stream provider response
        const reader = providerRes.body?.getReader();
        if (!reader) {
          const errChunk = JSON.stringify({ type: 'error', error: 'No response stream from provider' });
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const json = JSON.parse(dataStr);
                const delta = json.choices?.[0]?.delta?.content || json.delta?.text || json.message?.content;
                if (delta) {
                  const chunk = JSON.stringify({ type: 'chunk', content: delta });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
              } catch {
                // skip malformed JSON
              }
            }
          }

          // Send done
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (err) {
          const errChunk = JSON.stringify({ type: 'error', error: `Stream error: ${err instanceof Error ? err.message : String(err)}` });
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
