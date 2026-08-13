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
