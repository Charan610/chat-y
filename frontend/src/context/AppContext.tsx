'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { SessionProvider } from 'next-auth/react';
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
  syncUser,
  importConversations,
  saveMessageToBackend,
} from '@/lib/api';
import type { WebLLMProgress, WebLLMStatus, LocalModelId } from '@/lib/webllm';

// ── State ─────────────────────────────────────────────────────────────────────

export type ChatMode = 'local' | 'cloud';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  picture?: string;
  image?: string | null;
}

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
  chatMode: 'cloud',
  webllmStatus: 'idle',
  webllmProgress: { phase: 'idle', progress: 0, text: '' },
  webllmModelId: 'SmolLM-360M-Instruct-q4f16_1-MLC',
};

// ── Local Storage Helpers ──────────────────────────────────────────────────────

function saveConversationsToStorage(convs: Conversation[], userId?: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('chaty_conversations', JSON.stringify(convs));
    if (userId) {
      localStorage.setItem(`chaty_conversations_${userId}`, JSON.stringify(convs));
    }
  } catch {}
}

function loadConversationsFromStorage(userId?: string): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    if (userId) {
      const userConvs = localStorage.getItem(`chaty_conversations_${userId}`);
      if (userConvs) {
        const parsed = JSON.parse(userConvs);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
    const globalConvs = localStorage.getItem('chaty_conversations');
    if (globalConvs) {
      const parsed = JSON.parse(globalConvs);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

function saveActiveConversationId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem('chaty_active_conv_id', id);
    } else {
      localStorage.removeItem('chaty_active_conv_id');
    }
  } catch {}
}

function loadActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('chaty_active_conv_id');
  } catch {
    return null;
  }
}

function saveMessagesToStorage(convId: string, msgs: Message[]) {
  if (typeof window === 'undefined' || !convId) return;
  try {
    localStorage.setItem(`chaty_messages_${convId}`, JSON.stringify(msgs));
  } catch {}
}

function loadMessagesFromStorage(convId: string): Message[] {
  if (typeof window === 'undefined' || !convId) return [];
  try {
    const raw = localStorage.getItem(`chaty_messages_${convId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

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
      return { ...state, conversations: [action.payload, ...state.conversations.filter(c => c.id !== action.payload.id)] };
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
    case 'SET_MODEL': {
      const isLocal = action.payload.startsWith('webllm/');
      return {
        ...state,
        activeModel: action.payload,
        chatMode: isLocal ? 'local' : 'cloud',
      };
    }
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
  user: UserSession | null;
  dispatch: React.Dispatch<Action>;
  setActiveConversation: (id: string | null) => Promise<void>;
  sendMessage: (content: string, fileIds?: string[], convIdOverride?: string) => Promise<void>;
  stopStreaming: () => void;
  newConversation: (prompt?: string, fileIds?: string[]) => Promise<void>;
  deleteConv: (id: string) => Promise<void>;
  renameConv: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  showToast: (message: string, type?: Toast['type']) => void;
  loadWebLLM: (modelId?: string) => Promise<void>;
  handleGoogleSignIn: (user: UserSession) => Promise<void>;
  handleSignOut: () => void;
  importLocalChatsToAccount: () => Promise<void>;
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
  const [user, setUser] = React.useState<UserSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamContentRef = useRef('');

  // Initial user session & conversation history load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chaty_user_session');
      const storedName = localStorage.getItem('chaty_user_name');
      const storedId = localStorage.getItem('chaty_user_id');

      let activeUserId = '';

      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setUser(parsed);
          activeUserId = parsed.id;
          syncUser(parsed).catch(() => {});
        }
      } else if (storedName && storedId) {
        const sessionObj: UserSession = {
          id: storedId,
          email: `${storedName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
          name: storedName,
        };
        setUser(sessionObj);
        activeUserId = storedId;
        localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
        syncUser(sessionObj).catch(() => {});
      }

      // Load cached conversations immediately
      const cached = loadConversationsFromStorage(activeUserId);
      if (cached.length > 0) {
        dispatch({ type: 'SET_CONVERSATIONS', payload: cached });
        const lastActiveId = loadActiveConversationId();
        if (lastActiveId && cached.some(c => c.id === lastActiveId)) {
          dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: lastActiveId });
          const cachedMsgs = loadMessagesFromStorage(lastActiveId);
          if (cachedMsgs.length > 0) {
            dispatch({ type: 'SET_MESSAGES', payload: cachedMsgs });
          }
        }
      }
    } catch {}
  }, []);

  // Load initial remote data & sync with localStorage
  useEffect(() => {
    const load = async () => {
      // 1. Initial load of API keys from localStorage
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
        const storedModels = localStorage.getItem('chaty_models');
        if (storedModels) {
          const parsed = JSON.parse(storedModels);
          if (Array.isArray(parsed)) dispatch({ type: 'SET_MODELS', payload: parsed });
        }
      } catch {}

      try {
        const [convs, mems, keys, models, providers] = await Promise.allSettled([
          fetchConversations(user?.id),
          fetchMemories(),
          fetchAPIKeys(),
          fetchModels(),
          fetchProviders(),
        ]);
        if (convs.status === 'fulfilled' && convs.value && convs.value.length > 0) {
          dispatch({ type: 'SET_CONVERSATIONS', payload: convs.value });
          saveConversationsToStorage(convs.value, user?.id);
        }
        if (mems.status === 'fulfilled') dispatch({ type: 'SET_MEMORIES', payload: mems.value });
        if (keys.status === 'fulfilled' && keys.value) {
          let localKeys: APIKey[] = [];
          try {
            const raw = localStorage.getItem('chaty_api_keys');
            if (raw) localKeys = JSON.parse(raw);
          } catch {}

          const merged = keys.value.map(serverK => {
            const match = localKeys.find(l => l.id === serverK.id || l.provider === serverK.provider);
            return {
              ...serverK,
              api_key: serverK.api_key || match?.api_key || '',
            };
          });

          for (const localK of localKeys) {
            if (!merged.some(m => m.id === localK.id)) {
              merged.push(localK);
            }
          }

          dispatch({ type: 'SET_API_KEYS', payload: merged });
          try {
            localStorage.setItem('chaty_api_keys', JSON.stringify(merged));
          } catch {}
        }
        if (models.status === 'fulfilled' && models.value.length > 0) dispatch({ type: 'SET_MODELS', payload: models.value });
        if (providers.status === 'fulfilled') dispatch({ type: 'SET_PROVIDERS', payload: providers.value });
      } catch {
        // silently fail - backend may not be running yet
      }
    };
    load();
  }, [user?.id]);

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
    saveActiveConversationId(id);
    if (!id) {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      return;
    }

    // 1. Instant load from localStorage cache
    const cached = loadMessagesFromStorage(id);
    if (cached.length > 0) {
      dispatch({ type: 'SET_MESSAGES', payload: cached });
    } else {
      dispatch({ type: 'SET_MESSAGES', payload: [] });
    }

    if (id.startsWith('local-')) {
      return;
    }

    dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
    try {
      const msgs = await fetchMessages(id);
      if (msgs && msgs.length > 0) {
        if (msgs.length >= cached.length) {
          dispatch({ type: 'SET_MESSAGES', payload: msgs });
          saveMessagesToStorage(id, msgs);
        }
      }
    } catch {
      // Keep cached messages if server call fails
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
    }
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'SET_STREAMING', payload: false });
  }, []);

  // ── Send message — dual-path (local WebLLM or cloud API) ──
  const sendMessage = useCallback(async (content: string, fileIds?: string[], convIdOverride?: string) => {
    if (!content.trim() || state.isStreaming) return;

    let targetConvId = convIdOverride || state.activeConversationId;
    let currentConvs = [...state.conversations];

    // Auto-create conversation if none exists
    if (!targetConvId) {
      targetConvId = `conv-${Date.now()}`;
      const title = content.trim().slice(0, 32) + (content.trim().length > 32 ? '...' : '');
      const newConv: Conversation = {
        id: targetConvId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_pinned: false,
        is_favorite: false,
        is_archived: false,
        model: state.activeModel,
        message_count: 0,
        total_tokens: 0,
      };
      currentConvs = [newConv, ...currentConvs.filter(c => c.id !== targetConvId)];
      dispatch({ type: 'ADD_CONVERSATION', payload: newConv });
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: targetConvId });
      saveActiveConversationId(targetConvId);
      saveConversationsToStorage(currentConvs, user?.id);
    }

    // Always load existing messages from storage to ensure nothing is lost
    const existingMsgs = loadMessagesFromStorage(targetConvId);
    const baseMessages = existingMsgs.length > 0 ? existingMsgs : state.messages;

    const tempUserMsg: Message = {
      id: `user-${Date.now()}`,
      conversation_id: targetConvId,
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

    const updatedWithUser = [...baseMessages, tempUserMsg];
    dispatch({ type: 'ADD_MESSAGE', payload: tempUserMsg });
    saveMessagesToStorage(targetConvId, updatedWithUser);

    // Update conversation metadata
    const activeConv = currentConvs.find(c => c.id === targetConvId);
    if (activeConv) {
      const isInitialTitle = activeConv.title === 'New Conversation' || !activeConv.title;
      const updatedConv: Conversation = {
        ...activeConv,
        title: isInitialTitle ? (content.trim().slice(0, 32) + (content.trim().length > 32 ? '...' : '')) : activeConv.title,
        updated_at: new Date().toISOString(),
        message_count: updatedWithUser.length,
      };
      const updatedList = currentConvs.map(c => c.id === targetConvId ? updatedConv : c);
      currentConvs = updatedList;
      dispatch({ type: 'UPDATE_CONVERSATION', payload: updatedConv });
      saveConversationsToStorage(updatedList, user?.id);
    }

    const streamingId = `streaming-${Date.now()}`;
    dispatch({ type: 'SET_STREAMING_ID', payload: streamingId });
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'CLEAR_STREAM' });
    streamContentRef.current = '';

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // ─── LOCAL MODE (WebLLM) ───
    const isLocalModel = state.activeModel.startsWith('webllm/');
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

      // Augment local WebLLM with real-time web search if enabled
      let webSearchPrompt = '';
      if (state.webSearchEnabled || /\b(today|latest|recent|news|current|who won|score|weather|this week|2026|right now|now|happened|price|stock)\b/i.test(content)) {
        try {
          const { webSearch } = await import('@/lib/webSearch');
          const sResults = await webSearch(content, 5);
          if (sResults && sResults.length > 0) {
            const formatted = sResults
              .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
              .join('\n\n');
            webSearchPrompt = `\n\n--- REAL-TIME WEB SEARCH RESULTS ---\n${formatted}\n\nINSTRUCTIONS: Answer the user's question using the real-time web search results above. Cite sources using markdown links like [1](URL), [2](URL).`;
          }
        } catch {}
      }

      // Build messages array from conversation history
      const webllmSystemPrompt = `You are Chat-Y, a helpful AI assistant running locally in the user's browser via WebLLM. Be accurate and helpful.

When generating a complete file the user can save or preview (HTML, CSS, JS, Markdown, JSON, Python, etc.), wrap it EXACTLY like this:

<chaty-file name="index.html" type="html">
...full file content here...
</chaty-file>

Rules:
- Always include a real, sensible filename with correct extension in the name attribute
- type must be one of: html, css, js, json, md, py, txt
- Do not add explanation inside the chaty-file block — only the raw file content
- You may still explain what you built in normal text outside the block
- Only use this format for complete, standalone files — not small inline code snippets the user didn't ask to save`;

      const chatMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        { role: 'system', content: webllmSystemPrompt },
        ...baseMessages.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: content + webSearchPrompt },
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
            id: `assistant-${Date.now()}`,
            conversation_id: targetConvId || 'local',
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
          const finalMessages = [...updatedWithUser, assistantMsg];
          dispatch({ type: 'ADD_MESSAGE', payload: assistantMsg });
          dispatch({ type: 'SET_STREAMING', payload: false });
          dispatch({ type: 'CLEAR_STREAM' });
          dispatch({ type: 'SET_STREAMING_ID', payload: null });

          // Persist messages & updated conversation
          if (targetConvId) {
            saveMessagesToStorage(targetConvId, finalMessages);
            const conv = currentConvs.find(c => c.id === targetConvId);
            if (conv) {
              const updatedConv = { ...conv, message_count: finalMessages.length, updated_at: new Date().toISOString() };
              dispatch({ type: 'UPDATE_CONVERSATION', payload: updatedConv });
              saveConversationsToStorage(currentConvs.map(c => c.id === targetConvId ? updatedConv : c), user?.id);
            }
          }
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

    // ─── CLOUD MODE (direct client & backend streaming) ───
    let finalMetadata: Partial<Message> = {};
    let resolvedConvId = targetConvId;

    await streamChat(
      {
        conversation_id: targetConvId,
        message: content,
        model: state.activeModel,
        web_search: state.webSearchEnabled,
        file_ids: fileIds,
        messages: baseMessages.map(m => ({ role: m.role, content: m.content })),
      },
      (chunk) => {
        streamContentRef.current += chunk;
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
        const finalConvId = targetConvId || convId || resolvedConvId || '';
        dispatch({ type: 'SET_STREAMING', payload: false });

        const fullAssistantText = streamContentRef.current;
        if (!fullAssistantText.trim()) {
          dispatch({ type: 'CLEAR_STREAM' });
          dispatch({ type: 'SET_STREAMING_ID', payload: null });
          return;
        }

        const isStopped = abortRef.current?.signal.aborted || false;
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          conversation_id: finalConvId,
          role: 'assistant',
          content: fullAssistantText,
          model: finalMetadata.model || state.activeModel,
          provider: finalMetadata.provider || 'cloud',
          prompt_tokens: finalMetadata.prompt_tokens || 0,
          completion_tokens: finalMetadata.completion_tokens || 0,
          total_tokens: finalMetadata.total_tokens || 0,
          latency_ms: finalMetadata.latency_ms || 0,
          estimated_cost: finalMetadata.estimated_cost || 0,
          reasoning_content: finalMetadata.reasoning_content,
          metadata: {
            ...(finalMetadata.metadata || {}),
            ...(isStopped ? { stopped: true } : {}),
          },
          created_at: new Date().toISOString(),
          is_pinned: false,
        };

        const finalMessages = [...updatedWithUser, assistantMsg];
        dispatch({ type: 'ADD_MESSAGE', payload: assistantMsg });

        // Save messages in localStorage for both finalConvId and targetConvId / resolvedConvId
        if (finalConvId) {
          saveMessagesToStorage(finalConvId, finalMessages);
        }
        if (targetConvId && targetConvId !== finalConvId) {
          saveMessagesToStorage(targetConvId, finalMessages);
        }
        if (resolvedConvId && resolvedConvId !== finalConvId && resolvedConvId !== targetConvId) {
          saveMessagesToStorage(resolvedConvId, finalMessages);
        }

        // Fire-and-forget sync to backend
        if (finalConvId) {
          saveMessageToBackend(finalConvId, 'user', content).catch(() => {});
          if (fullAssistantText) {
            saveMessageToBackend(finalConvId, 'assistant', fullAssistantText, finalMetadata.provider || 'cloud').catch(() => {});
          }
        }

        // Update conversations in state and localStorage
        const existingConv = currentConvs.find(c => c.id === targetConvId || c.id === finalConvId || c.id === resolvedConvId);
        if (existingConv) {
          const updatedConv = {
            ...existingConv,
            id: finalConvId || existingConv.id,
            message_count: finalMessages.length,
            updated_at: new Date().toISOString(),
          };
          dispatch({ type: 'UPDATE_CONVERSATION', payload: updatedConv });
          const updatedList = currentConvs.map(c => (c.id === targetConvId || c.id === finalConvId || c.id === resolvedConvId) ? updatedConv : c);
          saveConversationsToStorage(updatedList, user?.id);
        }

        dispatch({ type: 'CLEAR_STREAM' });
        dispatch({ type: 'SET_STREAMING_ID', payload: null });
      },
      (err) => {
        dispatch({ type: 'SET_STREAMING', payload: false });
        const partialText = streamContentRef.current;
        const targetId = resolvedConvId || targetConvId || '';
        if (partialText && partialText.trim() && targetId) {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            conversation_id: targetId,
            role: 'assistant',
            content: partialText,
            model: finalMetadata.model || state.activeModel,
            provider: finalMetadata.provider || 'cloud',
            prompt_tokens: finalMetadata.prompt_tokens || 0,
            completion_tokens: finalMetadata.completion_tokens || 0,
            total_tokens: finalMetadata.total_tokens || 0,
            latency_ms: finalMetadata.latency_ms || 0,
            estimated_cost: finalMetadata.estimated_cost || 0,
            reasoning_content: finalMetadata.reasoning_content,
            metadata: {
              ...(finalMetadata.metadata || {}),
              stopped: true,
            },
            created_at: new Date().toISOString(),
            is_pinned: false,
          };
          const finalMessages = [...updatedWithUser, assistantMsg];
          dispatch({ type: 'ADD_MESSAGE', payload: assistantMsg });
          saveMessagesToStorage(targetId, finalMessages);
          saveMessageToBackend(targetId, 'assistant', partialText, finalMetadata.provider || 'cloud').catch(() => {});
        }
        dispatch({ type: 'CLEAR_STREAM' });
        dispatch({ type: 'SET_STREAMING_ID', payload: null });
        if (!ctrl.signal.aborted) {
          showToast(`Error: ${err}`, 'error');
        }
      },
      ctrl.signal
    );
  }, [state.isStreaming, state.activeConversationId, state.activeModel, state.webSearchEnabled, state.chatMode, state.webllmStatus, state.webllmModelId, state.messages, state.conversations, user?.id, showToast]);

  const newConversation = useCallback(async (prompt?: string, fileIds?: string[]) => {
    const tempId = `conv-${Date.now()}`;
    const initialTitle = prompt ? (prompt.slice(0, 32) + (prompt.length > 32 ? '...' : '')) : 'New Conversation';
    
    const fallbackConv: Conversation = {
      id: tempId,
      title: initialTitle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: false,
      is_favorite: false,
      is_archived: false,
      model: state.activeModel || 'groq/llama-3.3-70b-versatile',
      message_count: 0,
      total_tokens: 0,
    };

    dispatch({ type: 'ADD_CONVERSATION', payload: fallbackConv });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: tempId });
    saveActiveConversationId(tempId);
    dispatch({ type: 'SET_MESSAGES', payload: [] });

    // Save immediately to localStorage
    const currentList = [fallbackConv, ...state.conversations.filter(c => c.id !== tempId)];
    saveConversationsToStorage(currentList, user?.id);
    saveMessagesToStorage(tempId, []);

    if (prompt) {
      setTimeout(() => sendMessage(prompt, fileIds, tempId), 50);
    }
  }, [state.activeModel, state.conversations, user?.id, sendMessage]);

  const deleteConv = useCallback(async (id: string) => {
    try {
      await apiDeleteConversation(id).catch(() => {});
      dispatch({ type: 'REMOVE_CONVERSATION', payload: id });
      
      const filtered = state.conversations.filter(c => c.id !== id);
      saveConversationsToStorage(filtered, user?.id);
      if (state.activeConversationId === id) {
        saveActiveConversationId(null);
      }
      try {
        localStorage.removeItem(`chaty_messages_${id}`);
      } catch {}

      showToast('Conversation deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  }, [state.conversations, state.activeConversationId, user?.id, showToast]);

  const renameConv = useCallback(async (id: string, title: string) => {
    try {
      await updateConversation(id, { title }).catch(() => {});
      const target = state.conversations.find(c => c.id === id);
      if (target) {
        const updated = { ...target, title };
        dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
        saveConversationsToStorage(state.conversations.map(c => c.id === id ? updated : c), user?.id);
      }
      showToast('Conversation renamed', 'success');
    } catch {
      showToast('Failed to rename', 'error');
    }
  }, [state.conversations, user?.id, showToast]);

  const togglePin = useCallback(async (id: string) => {
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;
    try {
      const updated = { ...conv, is_pinned: !conv.is_pinned };
      await updateConversation(id, { is_pinned: updated.is_pinned }).catch(() => {});
      dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
      saveConversationsToStorage(state.conversations.map(c => c.id === id ? updated : c), user?.id);
    } catch {
      showToast('Failed to update', 'error');
    }
  }, [state.conversations, user?.id, showToast]);

  const handleGoogleSignIn = useCallback(async (userSession: UserSession) => {
    setUser(userSession);
    try {
      localStorage.setItem('chaty_user_session', JSON.stringify(userSession));
      localStorage.setItem('chaty_user_name', userSession.name);
      localStorage.setItem('chaty_user_id', userSession.id);
      await syncUser(userSession).catch(() => {});

      // Load user conversations if existing
      const userConvs = loadConversationsFromStorage(userSession.id);
      if (userConvs.length > 0) {
        dispatch({ type: 'SET_CONVERSATIONS', payload: userConvs });
      }

      showToast(`Welcome back, ${userSession.name}!`, 'success');
    } catch {
      showToast(`Welcome, ${userSession.name}`, 'info');
    }
  }, [showToast]);

  const handleSignOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem('chaty_user_session');
    } catch {}
    dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: null });
    dispatch({ type: 'SET_MESSAGES', payload: [] });
    showToast('Signed out of profile', 'info');
  }, [showToast]);

  const importLocalChatsToAccount = useCallback(async () => {
    if (!user) return;
    try {
      const localChats = state.conversations.map(c => ({
        title: c.title,
        model: c.model,
        messages: loadMessagesFromStorage(c.id),
      }));
      const res = await importConversations(user.id, localChats);
      showToast(`Successfully synced ${res.imported || localChats.length} chats to account!`, 'success');
    } catch {
      showToast('Failed to sync local chats', 'error');
    }
  }, [user, state.conversations, showToast]);

  return (
    <SessionProvider>
      <AppContext.Provider
        value={{
          state,
          user,
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
          handleGoogleSignIn,
          handleSignOut,
          importLocalChatsToAccount,
        }}
      >
        {children}
      </AppContext.Provider>
    </SessionProvider>
  );
}
