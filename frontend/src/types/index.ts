export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  folder_id?: string;
  is_pinned: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  model: string;
  message_count: number;
  total_tokens: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  provider?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost: number;
  created_at: string;
  is_pinned: boolean;
  reasoning_content?: string;
  metadata?: {
    files?: UploadedFile[];
    citations?: Citation[];
  };
}

export interface APIKey {
  id: string;
  provider: string;
  key_name: string;
  api_key: string;
  api_key_masked?: string;
  base_url?: string;
  is_active: boolean;
  is_default: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  is_enabled: boolean;
  is_default: boolean;
  priority: number;
  description?: string;
}

export interface Memory {
  id: string;
  category: string;
  content: string;
  tags: string[];
  created_at: string;
  is_pinned: boolean;
}

export interface UploadedFile {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  base_url: string;
  models: string[];
}

export interface AnalyticsData {
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  estimated_cost: number;
  daily_counts: { date: string; count: number }[];
  model_usage: { model: string; count: number; tokens: number; cost: number }[];
}

export interface StreamChunk {
  type: 'chunk' | 'metadata' | 'done' | 'error';
  content?: string;
  model?: string;
  provider?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  latency_ms?: number;
  estimated_cost?: number;
  message_id?: string;
  reasoning_content?: string;
  error?: string;
  citations?: Citation[];
  conversation_id?: string;
}

export interface ChatRequest {
  conversation_id?: string;
  message: string;
  model?: string;
  web_search?: boolean;
  file_ids?: string[];
  messages?: { role: string; content: string }[];
  api_keys?: Record<string, string>;
  api_configs?: Record<string, { api_key: string; base_url?: string }>;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
