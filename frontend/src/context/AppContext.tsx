'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type {
  Conversation,
  Message,
  Memory,
  APIKey,
  ModelConfig,
  Provider,
  UploadedFile,
  Toast,
} from '@/types';
import {
  fetchConversations,
  fetchMessages,
  createConversation,
  deleteConversation as apiDeleteConversation,
  updateConversation,
  fetchMemories,
  fetchAPIKeys,
  fetchModels,
  fetchProviders,
  streamChat,
} from '@/lib/api';
import type { WebLLMProgress, WebLLMStatus, LocalModelId } from '@/lib/webllm';

// ── State ─────────────────────────────────────────────────────────────────────

export type ChatMode = 'local' | 'cloud';

interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  activeModel: string;
  sidebarOpen: boolean;
  activePanelFile: UploadedFile | null;
  memories: Memory[];
  apiKeys: APIKey[];
  models: ModelConfig[];
  providers: Provider[];
  settingsOpen: boolean;
  settingsTab: string;
  webSearchEnabled: boolean;
  isLoadingMessages: boolean;
  toasts: Toast[];
  // ── WebLLM State ──
  chatMode: ChatMode;
  webllmStatus: WebLLMStatus;
  webllmProgress: WebLLMProgress;
  webllmModelId: string;
}

const initialState: AppState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  activeModel: 'groq/llama-3.3-70b-versatile',
  sidebarOpen: true,
  activePanelFile: null,
  memories: [],
  apiKeys: [],
  models: [],
  providers: [],
  settingsOpen: false,
  settingsTab: 'general',
  webSearchEnabled: false,
  isLoadingMessages: false,
  toasts: [],
  // ── WebLLM defaults ──
  chatMode: 'local',
  webllmStatus: 'idle',
  webllmProgress: { phase: 'idle', progress: 0, text: '' },
  webllmModelId: 'SmolLM-360M-Instruct-q4f16_1-MLC',
};

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'REMOVE_CONVERSATION'; payload: string }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Partial<Message> & { id: string } }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'APPEND_STREAM'; payload: string }
  | { type: 'SET_STREAMING_ID'; payload: string | null }
  | { type: 'CLEAR_STREAM' }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_PANEL_FILE'; payload: UploadedFile | null }
  | { type: 'SET_MEMORIES'; payload: Memory[] }
  | { type: 'ADD_MEMORY'; payload: Memory }
  | { type: 'REMOVE_MEMORY'; payload: string }
  | { type: 'SET_API_KEYS'; payload: APIKey[] }
  | { type: 'SET_MODELS'; payload: ModelConfig[] }
  | { type: 'SET_PROVIDERS'; payload: Provider[] }
  | { type: 'SET_SETTINGS_OPEN'; payload: boolean }
  | { type: 'SET_SETTINGS_TAB'; payload: string }
  | { type: 'TOGGLE_WEB_SEARCH' }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  // ── WebLLM Actions ──
  | { type: 'SET_CHAT_MODE'; payload: ChatMode }
  | { type: 'SET_WEBLLM_STATUS'; payload: WebLLMStatus }
  | { type: 'SET_WEBLLM_PROGRESS'; payload: WebLLMProgress }
  | { type: 'SET_WEBLLM_MODEL_ID'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'ADD_CONVERSATION':
      return { ...state, conversations: [action.payload, ...state.conversations] };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'REMOVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(c => c.id !== action.payload),
        activeConversationId:
          state.activeConversationId === action.payload ? null : state.activeConversationId,
        messages: state.activeConversationId === action.payload ? [] : state.messages,
      };
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'APPEND_STREAM':
      return { ...state, streamingContent: state.streamingContent + action.payload };
    case 'SET_STREAMING_ID':
      return { ...state, streamingMessageId: action.payload };
    case 'CLEAR_STREAM':
      return { ...state, streamingContent: '', streamingMessageId: null };
    case 'SET_MODEL':
      return { ...state, activeModel: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };
    case 'SET_PANEL_FILE':
      return { ...state, activePanelFile: action.payload };
    case 'SET_MEMORIES':
      return { ...state, memories: action.payload };
    case 'ADD_MEMORY':
      return { ...state, memories: [action.payload, ...state.memories] };
    case 'REMOVE_MEMORY':
      return { ...state, memories: state.memories.filter(m => m.id !== action.payload) };
    case 'SET_API_KEYS':
      return { ...state, apiKeys: action.payload };
    case 'SET_MODELS':
      return { ...state, models: action.payload };
    case 'SET_PROVIDERS':
      return { ...state, providers: action.payload };
    case 'SET_SETTINGS_OPEN':
      return { ...state, settingsOpen: action.payload };
    case 'SET_SETTINGS_TAB':
      return { ...state, settingsTab: action.payload };
    case 'TOGGLE_WEB_SEARCH':
      return { ...state, webSearchEnabled: !state.webSearchEnabled };
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    // ── WebLLM reducers ──
    case 'SET_CHAT_MODE':
      return { ...state, chatMode: action.payload };
    case 'SET_WEBLLM_STATUS':
      return { ...state, webllmStatus: action.payload };
    case 'SET_WEBLLM_PROGRESS':
      return { ...state, webllmProgress: action.payload };
    case 'SET_WEBLLM_MODEL_ID':
      return { ...state, webllmModelId: action.payload };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  setActiveConversation: (id: string | null) => Promise<void>;
  sendMessage: (content: string, fileIds?: string[]) => Promise<void>;
  stopStreaming: () => void;
  newConversation: (prompt?: string, fileIds?: string[]) => Promise<void>;
  deleteConv: (id: string) => Promise<void>;
  renameConv: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  showToast: (message: string, type?: Toast['type']) => void;
  loadWebLLM: (modelId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  // Use a ref to track streaming content for local mode since dispatch is async
  const streamContentRef = useRef('');

  // Load initial data
  useEffect(() => {
    const load = async () => {
      // 1. Initial load from localStorage for client persistence
      try {
        const storedKeys = localStorage.getItem('chaty_api_keys');
        if (storedKeys) {
          const parsed = JSON.parse(storedKeys);
          if (Array.isArray(parsed) && parsed.length > 0) {
            dispatch({ type: 'SET_API_KEYS', payload: parsed });
          }
        }
      } catch {}

      try {
        const [convs, mems, keys, models, providers] = await Promise.allSettled([
          fetchConversations(),
          fetchMemories(),
          fetchAPIKeys(),
          fetchModels(),
          fetchProviders(),
        ]);
        if (convs.status === 'fulfilled') dispatch({ type: 'SET_CONVERSATIONS', payload: convs.value });
        if (mems.status === 'fulfilled') dispatch({ type: 'SET_MEMORIES', payload: mems.value });
        if (keys.status === 'fulfilled' && keys.value && keys.value.length > 0) {
          dispatch({ type: 'SET_API_KEYS', payload: keys.value });
          try {
            localStorage.setItem('chaty_api_keys', JSON.stringify(keys.value));
          } catch {}
        }
        if (models.status === 'fulfilled') dispatch({ type: 'SET_MODELS', payload: models.value });
        if (providers.status === 'fulfilled') dispatch({ type: 'SET_PROVIDERS', payload: providers.value });
      } catch {
        // silently fail - backend may not be running yet
      }
    };
    load();
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 3500);
  }, []);

  // ── WebLLM loader ──
  const loadWebLLM = useCallback(async (modelId?: string) => {
    const { initWebLLMEngine, isWebGPUSupported } = await import('@/lib/webllm');

    if (!isWebGPUSupported()) {
      dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'unsupported' });
      showToast('WebGPU not supported in this browser. Use Chrome 113+ or add a cloud API key.', 'warning');
      dispatch({ type: 'SET_CHAT_MODE', payload: 'cloud' });
      return;
    }

    const targetModel = modelId || state.webllmModelId;
    dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'loading' });
    if (modelId) dispatch({ type: 'SET_WEBLLM_MODEL_ID', payload: modelId });

    try {
      await initWebLLMEngine(targetModel, (progress) => {
        dispatch({ type: 'SET_WEBLLM_PROGRESS', payload: progress });
        if (progress.phase === 'ready') {
          dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'ready' });
        }
      });
    } catch {
      dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'error' });
      showToast('Failed to load local model. Try a smaller model or use Cloud mode.', 'error');
    }
  }, [state.webllmModelId, showToast]);

  const setActiveConversation = useCallback(async (id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id });
    if (!id) {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      return;
    }
    dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
    try {
      const msgs = await fetchMessages(id);
      dispatch({ type: 'SET_MESSAGES', payload: msgs });
    } catch {
      showToast('Failed to load messages', 'error');
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
    }
  }, [showToast]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'SET_STREAMING', payload: false });
  }, []);

  // ── Send message — dual-path (local WebLLM or cloud API) ──
  const sendMessage = useCallback(async (content: string, fileIds?: string[]) => {
    if (!content.trim() || state.isStreaming) return;

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: state.activeConversationId || '',
      role: 'user',
      content,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      latency_ms: 0,
      estimated_cost: 0,
      created_at: new Date().toISOString(),
      is_pinned: false,
      metadata: fileIds?.length ? { files: fileIds.map(id => ({ id, filename: id, original_name: id, file_type: 'file', file_size: 0, mime_type: 'application/octet-stream', created_at: new Date().toISOString() })) } : undefined,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: tempUserMsg });

    const streamingId = `streaming-${Date.now()}`;
    dispatch({ type: 'SET_STREAMING_ID', payload: streamingId });
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'CLEAR_STREAM' });
    streamContentRef.current = '';

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // ─── LOCAL MODE (WebLLM) ───
    const isLocalModel = state.chatMode === 'local' || state.activeModel.startsWith('webllm/');
    if (isLocalModel) {
      const { chatWithWebLLM, isWebGPUSupported, initWebLLMEngine, getEngineStatus } = await import('@/lib/webllm');

      if (!isWebGPUSupported()) {
        dispatch({ type: 'SET_STREAMING', payload: false });
        dispatch({ type: 'CLEAR_STREAM' });
        dispatch({ type: 'SET_STREAMING_ID', payload: null });
        showToast('WebGPU is not supported in this browser. Please switch to Cloud Mode in Settings.', 'error');
        return;
      }

      // Auto-load model if not ready
      const localModelId = state.activeModel.startsWith('webllm/')
        ? state.activeModel.replace('webllm/', '')
        : state.webllmModelId;

      if (getEngineStatus() !== 'ready') {
        showToast(`Initializing local model (${localModelId})... Please wait.`, 'info');
        dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'loading' });
        try {
          await initWebLLMEngine(localModelId, (progress) => {
            dispatch({ type: 'SET_WEBLLM_PROGRESS', payload: progress });
            if (progress.phase === 'ready') {
              dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'ready' });
            }
          });
        } catch (err) {
          dispatch({ type: 'SET_STREAMING', payload: false });
          dispatch({ type: 'CLEAR_STREAM' });
          dispatch({ type: 'SET_STREAMING_ID', payload: null });
          dispatch({ type: 'SET_WEBLLM_STATUS', payload: 'error' });
          showToast(`Failed to load local model: ${err instanceof Error ? err.message : String(err)}`, 'error');
          return;
        }
      }

      // Build messages array from conversation history
      const chatMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        { role: 'system', content: 'You are Chat-Y, a helpful AI assistant running locally in the user\'s browser via WebLLM. Be concise and helpful.' },
        ...state.messages.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content },
      ];

      const startTime = Date.now();

      await chatWithWebLLM(
        chatMessages,
        (token) => {
          streamContentRef.current += token;
          dispatch({ type: 'APPEND_STREAM', payload: token });
        },
        (fullText, stats) => {
          const latency = Date.now() - startTime;
          const assistantMsg: Message = {
            id: `local-${Date.now()}`,
            conversation_id: state.activeConversationId || 'local',
            role: 'assistant',
            content: fullText,
            model: localModelId,
            provider: 'webllm',
            prompt_tokens: stats.promptTokens,
            completion_tokens: stats.completionTokens,
            total_tokens: stats.totalTokens,
            latency_ms: latency,
            estimated_cost: 0,
            created_at: new Date().toISOString(),
            is_pinned: false,
          };
          dispatch({ type: 'ADD_MESSAGE', payload: assistantMsg });
          dispatch({ type: 'SET_STREAMING', payload: false });
          dispatch({ type: 'CLEAR_STREAM' });
          dispatch({ type: 'SET_STREAMING_ID', payload: null });
        },
        (err) => {
          dispatch({ type: 'SET_STREAMING', payload: false });
          dispatch({ type: 'CLEAR_STREAM' });
          dispatch({ type: 'SET_STREAMING_ID', payload: null });
          showToast(`Local model error: ${err}`, 'error');
        },
        ctrl.signal,
      );
      return;
    }

    // ─── CLOUD MODE (existing backend streaming) ───
    let finalMetadata: Partial<Message> = {};
    let resolvedConvId = state.activeConversationId || '';

    await streamChat(
      {
        conversation_id: state.activeConversationId || undefined,
        message: content,
        model: state.activeModel,
        web_search: state.webSearchEnabled,
        file_ids: fileIds,
      },
      (chunk) => {
        dispatch({ type: 'APPEND_STREAM', payload: chunk });
      },
      (meta) => {
        finalMetadata = {
          ...finalMetadata,
          model: meta.model,
          provider: meta.provider,
          prompt_tokens: meta.prompt_tokens || 0,
          completion_tokens: meta.completion_tokens || 0,
          total_tokens: meta.total_tokens || 0,
          latency_ms: meta.latency_ms || 0,
          estimated_cost: meta.estimated_cost || 0,
          reasoning_content: meta.reasoning_content,
          metadata: meta.citations ? { citations: meta.citations } : undefined,
        };
        if (meta.conversation_id) {
          resolvedConvId = meta.conversation_id;
        }
      },
      async (convId) => {
        resolvedConvId = convId || resolvedConvId;
        dispatch({ type: 'SET_STREAMING', payload: false });

        // Build final assistant message from streamed content
        // We get the current streaming content from state via a ref approach
        // Instead, we refetch messages for accuracy
        try {
          if (resolvedConvId) {
            const msgs = await fetchMessages(resolvedConvId);
            dispatch({ type: 'SET_MESSAGES', payload: msgs });

            // Update or add conversation
            const convs = await fetchConversations();
            dispatch({ type: 'SET_CONVERSATIONS', payload: convs });
            dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: resolvedConvId });
          }
        } catch {
          // keep streaming content visible
        }
        dispatch({ type: 'CLEAR_STREAM' });
        dispatch({ type: 'SET_STREAMING_ID', payload: null });
      },
      (err) => {
        dispatch({ type: 'SET_STREAMING', payload: false });
        dispatch({ type: 'CLEAR_STREAM' });
        dispatch({ type: 'SET_STREAMING_ID', payload: null });
        showToast(`Error: ${err}`, 'error');
      },
      ctrl.signal
    );
  }, [state.isStreaming, state.activeConversationId, state.activeModel, state.webSearchEnabled, state.chatMode, state.webllmStatus, state.webllmModelId, state.messages, showToast]);

  const newConversation = useCallback(async (prompt?: string, fileIds?: string[]) => {
    // In local mode, just clear messages and start fresh locally
    if (state.chatMode === 'local') {
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: `local-${Date.now()}` });
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      if (prompt) {
        setTimeout(() => sendMessage(prompt, fileIds), 50);
      }
      return;
    }
    try {
      const conv = await createConversation({ model: state.activeModel });
      dispatch({ type: 'ADD_CONVERSATION', payload: conv });
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv.id });
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      if (prompt) {
        // Small delay to ensure state is set
        setTimeout(() => sendMessage(prompt, fileIds), 50);
      }
    } catch {
      showToast('Failed to create conversation', 'error');
    }
  }, [state.activeModel, state.chatMode, sendMessage, showToast]);

  const deleteConv = useCallback(async (id: string) => {
    try {
      await apiDeleteConversation(id);
      dispatch({ type: 'REMOVE_CONVERSATION', payload: id });
      showToast('Conversation deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  }, [showToast]);

  const renameConv = useCallback(async (id: string, title: string) => {
    try {
      const updated = await updateConversation(id, { title });
      dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
    } catch {
      showToast('Failed to rename', 'error');
    }
  }, [showToast]);

  const togglePin = useCallback(async (id: string) => {
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;
    try {
      const updated = await updateConversation(id, { is_pinned: !conv.is_pinned });
      dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
    } catch {
      showToast('Failed to update', 'error');
    }
  }, [state.conversations, showToast]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        setActiveConversation,
        sendMessage,
        stopStreaming,
        newConversation,
        deleteConv,
        renameConv,
        togglePin,
        showToast,
        loadWebLLM,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
