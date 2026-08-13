import type {
  Conversation,
  Message,
  APIKey,
  ModelConfig,
  Memory,
  UploadedFile,
  Provider,
  AnalyticsData,
  StreamChunk,
  ChatRequest,
} from '@/types';

const BASE_URL = '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    if (err.includes('<!DOCTYPE html>') || err.includes('<html') || err.includes('This page could not be found')) {
      throw new Error(`Endpoint not found (HTTP ${res.status})`);
    }
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ── Conversations ────────────────────────────────────────────────────────────
export async function fetchConversations(): Promise<Conversation[]> {
  return apiClient.get<Conversation[]>('/api/conversations');
}

export async function createConversation(data: { title?: string; model?: string }): Promise<Conversation> {
  return apiClient.post<Conversation>('/api/conversations', data);
}

export async function updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
  return apiClient.patch<Conversation>(`/api/conversations/${id}`, data);
}

export async function deleteConversation(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/conversations/${id}`);
}

// ── Messages ─────────────────────────────────────────────────────────────────
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  return apiClient.get<Message[]>(`/api/conversations/${conversationId}/messages`);
}

export async function streamDirectCloud(
  req: ChatRequest,
  onChunk: (text: string) => void,
  onMetadata: (data: Partial<StreamChunk>) => void,
  onDone: (conversationId: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<boolean> {
  let keys: Record<string, string> = {};
  if (req.api_keys) {
    keys = req.api_keys;
  } else {
    try {
      const raw = localStorage.getItem('chaty_api_keys');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const k of parsed) {
            if (k.provider && k.api_key) keys[k.provider] = k.api_key;
          }
        }
      }
    } catch {}
  }

  const modelStr = req.model || 'groq/llama-3.3-70b-versatile';
  let provider = 'groq';
  let rawModelId = modelStr;

  if (modelStr.includes('/')) {
    const parts = modelStr.split('/');
    provider = parts[0];
    rawModelId = parts.slice(1).join('/');
  } else if (modelStr.startsWith('gpt-') || modelStr.startsWith('o1')) {
    provider = 'openai';
  } else if (modelStr.startsWith('claude-')) {
    provider = 'anthropic';
  } else if (modelStr.startsWith('llama-') || modelStr.startsWith('mixtral-') || modelStr.startsWith('gemma')) {
    provider = 'groq';
  }

  let apiKey = keys[provider];
  let activeProvider = provider;

  if (!apiKey) {
    if (keys['groq']) { activeProvider = 'groq'; apiKey = keys['groq']; rawModelId = 'llama-3.3-70b-versatile'; }
    else if (keys['openai']) { activeProvider = 'openai'; apiKey = keys['openai']; rawModelId = 'gpt-4o-mini'; }
    else if (keys['nvidia_nim']) { activeProvider = 'nvidia_nim'; apiKey = keys['nvidia_nim']; rawModelId = 'meta/llama-3.1-70b-instruct'; }
    else if (keys['openrouter']) { activeProvider = 'openrouter'; apiKey = keys['openrouter']; rawModelId = 'meta-llama/llama-3.3-70b-instruct'; }
  }

  if (!apiKey) {
    return false;
  }

  let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (activeProvider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (activeProvider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (activeProvider === 'nvidia_nim') {
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (activeProvider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const convId = req.conversation_id || `conv-${Date.now()}`;
    onMetadata({
      model: rawModelId,
      provider: activeProvider,
      conversation_id: convId,
    });

    const bodyData = {
      model: rawModelId,
      messages: [{ role: 'user', content: req.message }],
      stream: true,
      temperature: 0.7,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      onError(`Direct Provider Error (${res.status}): ${errText.slice(0, 120)}`);
      return true;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('Direct response stream unavailable');
      return true;
    }

    const decoder = new TextDecoder();
    let buffer = '';

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
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            onChunk(delta);
          }
        } catch {}
      }
    }

    onDone(convId);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return true;
    onError(`Direct API call error: ${err instanceof Error ? err.message : String(err)}`);
    return true;
  }
}

// ── Streaming Chat ────────────────────────────────────────────────────────────
export async function streamChat(
  req: ChatRequest,
  onChunk: (text: string) => void,
  onMetadata: (data: Partial<StreamChunk>) => void,
  onDone: (conversationId: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let conversationId = req.conversation_id || '';
  try {
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
    if (!res.ok) {
      const err = await res.text();
      const isHtml = err.includes('<!DOCTYPE html>') || err.includes('<html') || err.includes('This page could not be found');
      if (res.status === 404 || isHtml) {
        const handledDirectly = await streamDirectCloud(req, onChunk, onMetadata, onDone, onError, signal);
        if (handledDirectly) return;
        onError('Backend server offline. Please add your Groq or OpenAI API key in Settings to enable direct cloud chat.');
        return;
      }
      onError(err || `HTTP ${res.status}`);
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      onError('No readable stream');
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const chunk: StreamChunk = JSON.parse(raw);
          if (chunk.type === 'chunk' && chunk.content) {
            onChunk(chunk.content);
          } else if (chunk.type === 'metadata') {
            if (chunk.conversation_id) {
              conversationId = chunk.conversation_id;
            }
            onMetadata(chunk);
          } else if (chunk.type === 'error') {
            onError(chunk.error || 'Unknown error');
            return;
          }
        } catch {
          // ignore JSON parse errors on malformed lines
        }
      }
    }
    onDone(conversationId);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return;
    const isHtmlErr = String(err).includes('<!DOCTYPE html>') || String(err).includes('This page could not be found');
    if (isHtmlErr) {
      const handledDirectly = await streamDirectCloud(req, onChunk, onMetadata, onDone, onError, signal);
      if (handledDirectly) return;
      onError('Backend server offline. Please add your Groq or OpenAI API key in Settings to enable direct cloud chat.');
      return;
    }
    onError(err instanceof Error ? err.message : String(err));
  }
}

// ── File Upload ───────────────────────────────────────────────────────────────
export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('files', file);
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/files/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchFiles(): Promise<UploadedFile[]> {
  return apiClient.get<UploadedFile[]>('/api/files');
}

export async function deleteFile(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/files/${id}`);
}

// ── API Keys ──────────────────────────────────────────────────────────────────
export async function fetchAPIKeys(): Promise<APIKey[]> {
  return apiClient.get<APIKey[]>('/api/apikeys');
}

export async function createAPIKey(data: Partial<APIKey>): Promise<APIKey> {
  return apiClient.post<APIKey>('/api/apikeys', data);
}

export async function updateAPIKey(id: string, data: Partial<APIKey>): Promise<APIKey> {
  return apiClient.patch<APIKey>(`/api/apikeys/${id}`, data);
}

export async function deleteAPIKey(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/apikeys/${id}`);
}

export async function checkAPIKey(id: string, keyObj?: APIKey): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await apiClient.post<{ status: string; message?: string; http_status?: number }>(`/api/apikeys/${id}/health-check`);
    return {
      ok: res.status === 'ok',
      message: res.message || (res.status === 'ok' ? 'Key is working' : `Key returned status: ${res.status}`),
    };
  } catch (err: unknown) {
    if (keyObj && keyObj.api_key) {
      try {
        let testUrl = '';
        const headers: Record<string, string> = {};
        if (keyObj.provider === 'groq') {
          testUrl = 'https://api.groq.com/openai/v1/models';
          headers['Authorization'] = `Bearer ${keyObj.api_key}`;
        } else if (keyObj.provider === 'openai') {
          testUrl = 'https://api.openai.com/v1/models';
          headers['Authorization'] = `Bearer ${keyObj.api_key}`;
        } else if (keyObj.provider === 'nvidia_nim') {
          testUrl = keyObj.base_url || 'https://integrate.api.nvidia.com/v1/models';
          headers['Authorization'] = `Bearer ${keyObj.api_key}`;
        } else if (keyObj.provider === 'openrouter') {
          testUrl = 'https://openrouter.ai/api/v1/models';
          headers['Authorization'] = `Bearer ${keyObj.api_key}`;
        }
        if (testUrl) {
          const directRes = await fetch(testUrl, { headers });
          if (directRes.ok) {
            return { ok: true, message: 'Key verified directly with provider!' };
          } else {
            return { ok: false, message: `Provider returned HTTP ${directRes.status}` };
          }
        }
      } catch {
        // network or CORS fallback
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: msg.includes('<!DOCTYPE html>') || msg.includes('<html')
        ? 'Backend endpoint offline. Key saved in browser storage.'
        : msg,
    };
  }
}

// ── Models ────────────────────────────────────────────────────────────────────
export async function fetchModels(): Promise<ModelConfig[]> {
  return apiClient.get<ModelConfig[]>('/api/models');
}

export async function createModel(data: Partial<ModelConfig>): Promise<ModelConfig> {
  return apiClient.post<ModelConfig>('/api/models', data);
}

export async function updateModel(id: string, data: Partial<ModelConfig>): Promise<ModelConfig> {
  return apiClient.patch<ModelConfig>(`/api/models/${id}`, data);
}

export async function deleteModel(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/models/${id}`);
}

// ── Memories ──────────────────────────────────────────────────────────────────
export async function fetchMemories(): Promise<Memory[]> {
  return apiClient.get<Memory[]>('/api/memories');
}

export async function createMemory(data: Partial<Memory>): Promise<Memory> {
  return apiClient.post<Memory>('/api/memories', data);
}

export async function deleteMemory(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/memories/${id}`);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export async function fetchAnalytics(): Promise<AnalyticsData> {
  return apiClient.get<AnalyticsData>('/api/analytics');
}

// ── Providers ─────────────────────────────────────────────────────────────────
export async function fetchProviders(): Promise<Provider[]> {
  return apiClient.get<Provider[]>('/api/providers');
}
