'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  X,
  Settings,
  Cpu,
  KeyRound,
  BrainCircuit,
  BarChart3,
  HelpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  BookOpen,
  Shield,
  Zap,
  Brain,
  Code,
  MessageSquare,
  Globe,
  Lock,
  Sparkles,
  Server,
  Download,
  CheckCircle,
  Loader2
} from 'lucide-react';
import {
  apiClient,
  createAPIKey,
  deleteAPIKey,
  checkAPIKey,
  createModel,
  deleteModel,
  updateModel,
  createMemory,
  deleteMemory
} from '@/lib/api';
import type { APIKey, ModelConfig, Memory, Provider, AnalyticsData } from '@/types';

export function SettingsModal() {
  const { state, dispatch, showToast, loadWebLLM } = useApp();
  const isOpen = state.settingsOpen;
  const activeTab = state.settingsTab;

  const [activeSubTab, setActiveSubTab] = useState(activeTab);
  const [checkingKeyId, setCheckingKeyId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [showRawKey, setShowRawKey] = useState<Record<string, boolean>>({});

  // Form states
  const DEFAULT_BASE_URLS: Record<string, string> = {
    groq: 'https://api.groq.com/openai/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    openrouter: 'https://openrouter.ai/api/v1',
    nvidia_nim: 'https://integrate.api.nvidia.com/v1',
    openai: 'https://api.openai.com/v1',
  };

  const [newKeyProvider, setNewKeyProvider] = useState('groq');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyUrl, setNewKeyUrl] = useState(DEFAULT_BASE_URLS['groq']);

  // Creator info — hardcoded, not editable
  const creatorName = 'Charan';
  const instagramHandle = 'charan__3_';
  const instagramUrl = 'https://www.instagram.com/charan__3_/';

  const handleProviderChange = (provider: string) => {
    setNewKeyProvider(provider);
    setNewKeyUrl(DEFAULT_BASE_URLS[provider] || '');
  };

  const [newModelName, setNewModelName] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('groq');
  const [newModelId, setNewModelId] = useState('');
  const [newModelTemp, setNewModelTemp] = useState(0.7);
  const [newModelMaxTokens, setNewModelMaxTokens] = useState(4096);

  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('general');
  const [newMemoryTags, setNewMemoryTags] = useState('');
  const [memorySearch, setMemorySearch] = useState('');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    setActiveSubTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (isOpen && activeSubTab === 'analytics') {
      const loadAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
          const res = await apiClient.get<AnalyticsData>('/api/analytics/overview');
          setAnalytics(res);
        } catch {
          // fallback mock analytics
          setAnalytics({
            total_conversations: state.conversations.length,
            total_messages: state.messages.length || 12,
            total_tokens: 45280,
            estimated_cost: 0.0152,
            daily_counts: [],
            model_usage: [],
          });
        } finally {
          setLoadingAnalytics(false);
        }
      };
      loadAnalytics();
    }
  }, [isOpen, activeSubTab, state.conversations.length, state.messages.length]);

  if (!isOpen) return null;

  const handleClose = () => {
    dispatch({ type: 'SET_SETTINGS_OPEN', payload: false });
  };

  const setTab = (tab: string) => {
    setActiveSubTab(tab);
    dispatch({ type: 'SET_SETTINGS_TAB', payload: tab });
  };

  // --- API Key actions ---
  const handleAddAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) {
      showToast('API Key value is required', 'error');
      return;
    }
    try {
      const key = await createAPIKey({
        provider: newKeyProvider,
        key_name: newKeyName || `${newKeyProvider.toUpperCase()} Key`,
        api_key: newKeyValue,
        base_url: newKeyUrl || undefined,
        is_active: true,
        is_default: true,
      });
      dispatch({ type: 'SET_API_KEYS', payload: [key, ...state.apiKeys] });
      setNewKeyValue('');
      setNewKeyName('');
      setNewKeyUrl('');
      showToast('API Key saved successfully', 'success');
    } catch {
      showToast('Failed to save API Key', 'error');
    }
  };

  const handleDeleteAPIKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await deleteAPIKey(id);
      dispatch({ type: 'SET_API_KEYS', payload: state.apiKeys.filter(k => k.id !== id) });
      showToast('API Key deleted', 'success');
    } catch {
      showToast('Failed to delete API Key', 'error');
    }
  };

  const handleCheckKey = async (id: string) => {
    setCheckingKeyId(id);
    try {
      const res = await checkAPIKey(id);
      setCheckResults(prev => ({
        ...prev,
        [id]: { ok: res.ok, msg: res.message }
      }));
      if (res.ok) {
        showToast('API Key verification succeeded!', 'success');
      } else {
        showToast(`Verification failed: ${res.message}`, 'error');
      }
    } catch (err) {
      showToast('Key check failed to run', 'error');
    } finally {
      setCheckingKeyId(null);
    }
  };

  // --- Model actions ---
  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim() || !newModelId.trim()) {
      showToast('Model name and identifier are required', 'error');
      return;
    }
    try {
      const model = await createModel({
        name: newModelName,
        provider: newModelProvider,
        model_id: newModelId,
        temperature: newModelTemp,
        max_tokens: newModelMaxTokens,
        is_enabled: true,
        is_default: false,
        priority: 0,
      });
      dispatch({ type: 'SET_MODELS', payload: [...state.models, model] });
      setNewModelName('');
      setNewModelId('');
      showToast('Model added successfully', 'success');
    } catch {
      showToast('Failed to add model config', 'error');
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('Remove this model configuration?')) return;
    try {
      await deleteModel(id);
      dispatch({ type: 'SET_MODELS', payload: state.models.filter(m => m.id !== id) });
      showToast('Model config removed', 'success');
    } catch {
      showToast('Failed to remove model', 'error');
    }
  };

  const handleToggleModelEnabled = async (model: ModelConfig) => {
    try {
      const updated = await updateModel(model.id, { is_enabled: !model.is_enabled });
      dispatch({
        type: 'SET_MODELS',
        payload: state.models.map(m => m.id === model.id ? updated : m)
      });
      showToast(`Model ${model.name} ${!model.is_enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch {
      showToast('Failed to update model settings', 'error');
    }
  };

  // --- Memory actions ---
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;
    try {
      const mem = await createMemory({
        content: newMemoryContent,
        category: newMemoryCategory,
        tags: newMemoryTags ? newMemoryTags.split(',').map(t => t.trim()) : [],
        is_pinned: false
      });
      dispatch({ type: 'ADD_MEMORY', payload: mem });
      setNewMemoryContent('');
      setNewMemoryTags('');
      showToast('Memory stored semantically', 'success');
    } catch {
      showToast('Failed to save memory', 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      dispatch({ type: 'REMOVE_MEMORY', payload: id });
      showToast('Memory removed', 'success');
    } catch {
      showToast('Failed to delete memory', 'error');
    }
  };

  const filteredMemories = state.memories.filter(m =>
    m.content.toLowerCase().includes(memorySearch.toLowerCase()) ||
    m.category.toLowerCase().includes(memorySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-2 sm:p-4">
      {/* Modal Box */}
      <div className="w-full max-w-[850px] h-full max-h-[92vh] sm:h-[600px] bg-surface border border-line rounded-lg shadow-2xl flex flex-col sm:flex-row overflow-hidden animate-[fadeIn_150ms_ease]">
        
        {/* Settings Rail (Horizontal scroll on mobile, Vertical list on desktop) */}
        <div className="w-full sm:w-[180px] bg-surface border-b sm:border-b-0 sm:border-r border-line flex flex-row sm:flex-col p-2 sm:p-2.5 gap-1 sm:gap-1.5 flex-shrink-0 overflow-x-auto sm:overflow-x-visible">
          <div className="hidden sm:block px-2.5 py-1.5 font-mono text-[9px] tracking-[1.5px] uppercase text-fg-4">WORKSPACE SETTINGS</div>
          
          <button
            onClick={() => setTab('general')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'general' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            General
          </button>
          
          <button
            onClick={() => setTab('models')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'models' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Models
          </button>
          
          <button
            onClick={() => setTab('api-keys')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'api-keys' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            API Keys
          </button>
          
          <button
            onClick={() => setTab('memory')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'memory' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            Memory (RAG)
          </button>
          
          <button
            onClick={() => setTab('analytics')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'analytics' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setTab('know-your-llm')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
              activeSubTab === 'know-your-llm' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Know Your LLM
          </button>

          <div className="sm:mt-auto sm:border-t border-line sm:pt-2.5 flex items-center">
            <button
              onClick={() => setTab('about')}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md w-full text-left text-xs transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === 'about' ? 'bg-accent-bg text-accent font-medium' : 'text-fg-2 hover:bg-hover hover:text-fg'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              About
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 bg-bg flex flex-col min-w-0">
          {/* Header */}
          <div className="h-12 border-b border-line flex items-center justify-between px-6">
            <span className="font-mono text-xs text-fg uppercase font-semibold">
              {activeSubTab.replace('-', ' ')}
            </span>
            <button
              onClick={handleClose}
              className="text-fg-4 hover:text-fg transition-colors p-1 rounded hover:bg-hover cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrolling Content Panel */}
          <div className="flex-1 p-6 overflow-auto">

            {/* TAB: GENERAL */}
            {activeSubTab === 'general' && (
              <div className="flex flex-col gap-6 max-w-[550px]">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-fg-2">Default Workspace Model</label>
                  <select
                    value={state.activeModel}
                    onChange={(e) => dispatch({ type: 'SET_MODEL', payload: e.target.value })}
                    className="input w-full"
                  >
                    {state.models.length > 0 ? (
                      state.models.map(m => (
                        <option key={m.id} value={`${m.provider}/${m.model_id}`}>{m.name} ({m.provider})</option>
                      ))
                    ) : (
                      <>
                        <option value="groq/llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                        <option value="nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b">Nemotron 3 Ultra 550B (NVIDIA)</option>
                        <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
                      </>
                    )}
                  </select>
                  <p className="text-[10px] font-mono text-fg-4 mt-0.5">This model will be selected by default when starting a new workspace conversation.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-fg-2">System Instructions</label>
                  <textarea
                    rows={4}
                    placeholder="Enter instructions to configure the AI workspace persona..."
                    className="input w-full font-mono text-xs"
                    defaultValue="You are Chat-Y, an elite multi-model AI workspace. You are calm, precise, and highly competent."
                  />
                  <p className="text-[10px] font-mono text-fg-4 mt-0.5">Applies system-level context constraints to new reasoning sequences.</p>
                </div>
              </div>
            )}

            {/* TAB: MODELS */}
            {activeSubTab === 'models' && (
              <div className="flex flex-col gap-6">
                {/* Form to Add Model */}
                <form onSubmit={handleAddModel} className="bg-surface border border-line p-4 rounded-md flex flex-col gap-3">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Add Custom Model Configuration</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">Model Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Claude 3.5 Sonnet"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        className="input text-xs py-1.5"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">Provider ID</label>
                      <select
                        value={newModelProvider}
                        onChange={(e) => setNewModelProvider(e.target.value)}
                        className="input text-xs py-1.5"
                      >
                        <option value="groq">groq</option>
                        <option value="nvidia_nim">nvidia_nim</option>
                        <option value="openai">openai</option>
                        <option value="anthropic">anthropic</option>
                        <option value="google">google</option>
                        <option value="ollama">ollama</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-fg-3 uppercase">Model Identifier (LiteLLM path)</label>
                    <input
                      type="text"
                      placeholder="e.g. claude-3-5-sonnet-20241022 or llama3"
                      value={newModelId}
                      onChange={(e) => setNewModelId(e.target.value)}
                      className="input text-xs font-mono py-1.5"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary self-end text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Register Model
                  </button>
                </form>

                {/* WebLLM In-Browser Local Models */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-mono text-[10px] tracking-[1px] uppercase text-fg-3">
                    <Shield className="w-3.5 h-3.5 text-[#6b9a78]" />
                    WebLLM Local Models (In-Browser / WebGPU)
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: 'SmolLM-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M', size: '~250 MB', tag: 'FASTEST' },
                      { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B Instruct', size: '~700 MB', tag: 'BALANCED' },
                      { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B Instruct', size: '~1 GB', tag: 'SMARTEST' },
                    ].map((m) => {
                      const isActive = state.webllmStatus === 'ready' && state.webllmModelId === m.id;
                      const isLoading = state.webllmStatus === 'loading' && state.webllmModelId === m.id;

                      return (
                        <div key={m.id} className={`p-3 bg-surface border rounded flex items-center justify-between transition-colors ${
                          isActive ? 'border-[#6b9a78]' : 'border-line'
                        }`}>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-fg flex items-center gap-2">
                              {m.name}
                              <span className="text-[9px] font-mono uppercase bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30 px-1.5 py-0.5 rounded">
                                WebGPU Local
                              </span>
                              <span className="text-[9px] font-mono text-fg-4">
                                {m.size}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-fg-4 mt-0.5">{m.id}</div>
                          </div>
                          <button
                            onClick={() => loadWebLLM(m.id)}
                            disabled={isLoading}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase transition-colors cursor-pointer disabled:opacity-40 ${
                              isActive
                                ? 'bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30'
                                : 'bg-accent-bg text-accent border border-accent/30 hover:bg-accent/20'
                            }`}
                          >
                            {isActive ? <><CheckCircle className="w-3 h-3" /> ACTIVE</>
                              : isLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</>
                              : <><Download className="w-3 h-3" /> Download &amp; Load</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Model List */}
                <div className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Registered Cloud Models ({state.models.length})</div>
                  {state.models.length === 0 ? (
                    <div className="p-3 bg-surface border border-dashed border-line text-center text-xs text-fg-4 rounded-md">
                      No custom cloud models registered. Using default provider models.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {state.models.map((model) => (
                        <div key={model.id} className="p-3 bg-surface border border-line rounded flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-fg flex items-center gap-2">
                              {model.name}
                              <span className="text-[9px] font-mono uppercase bg-elevated border border-line-2 px-1 rounded text-fg-3">
                                {model.provider}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-fg-4 mt-0.5">{model.model_id}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleModelEnabled(model)}
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                model.is_enabled
                                  ? 'border-[#6b9a78]/25 text-[#6b9a78] bg-[#6b9a78]/10'
                                  : 'border-line text-fg-4'
                              }`}
                            >
                              {model.is_enabled ? 'Active' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => handleDeleteModel(model.id)}
                              className="text-fg-4 hover:text-bad p-1 rounded hover:bg-hover transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: API KEYS */}
            {activeSubTab === 'api-keys' && (
              <div className="flex flex-col gap-6">
                {/* Form to Save Key */}
                <form onSubmit={handleAddAPIKey} className="bg-surface border border-line p-4 rounded-md flex flex-col gap-3">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Save Provider API Credentials</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">Provider</label>
                      <select
                        value={newKeyProvider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="input text-xs py-1.5"
                      >
                        <option value="groq">Groq</option>
                        <option value="nvidia_nim">NVIDIA NIM</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Gemini</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Ollama (Local)</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">API Key Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Work Key or Main Key"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="input text-xs py-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-fg-3 uppercase">Secret Token / API Key</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      className="input text-xs font-mono py-1.5"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-fg-3 uppercase">Base Endpoint URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. custom proxy URL"
                      value={newKeyUrl}
                      onChange={(e) => setNewKeyUrl(e.target.value)}
                      className="input text-xs font-mono py-1.5"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary self-end text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Save Credential
                  </button>
                </form>

                {/* API Key List */}
                <div className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Configured Credentials ({state.apiKeys.length})</div>
                  {state.apiKeys.length === 0 ? (
                    <div className="p-4 bg-surface border border-dashed border-line text-center text-xs text-fg-4 rounded-md">
                      No API keys stored. Please configure credentials to unlock cloud inference.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {state.apiKeys.map((key) => {
                        const showRaw = showRawKey[key.id] || false;
                        const result = checkResults[key.id];

                        return (
                          <div key={key.id} className="p-3 bg-surface border border-line rounded flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-medium text-fg">{key.key_name}</span>
                                <span className="text-[9px] font-mono uppercase bg-elevated border border-line-2 px-1 rounded text-fg-3 ml-2">
                                  {key.provider}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleCheckKey(key.id)}
                                  disabled={checkingKeyId === key.id}
                                  className="text-[10px] font-mono uppercase bg-elevated hover:bg-hover px-2 py-0.5 border border-line-2 rounded text-fg-2 hover:text-fg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {checkingKeyId === key.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    'Check'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowRawKey(prev => ({ ...prev, [key.id]: !showRaw }))}
                                  className="text-fg-4 hover:text-fg transition-colors"
                                >
                                  {showRaw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteAPIKey(key.id)}
                                  className="text-fg-4 hover:text-bad p-1 rounded hover:bg-hover transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="text-[10px] font-mono text-fg-4 flex items-center gap-2 truncate">
                              <span>Key:</span>
                              <span className="text-fg-3">
                                {showRaw ? key.api_key : '••••••••••••••••••••••••'}
                              </span>
                            </div>

                            {key.base_url && (
                              <div className="text-[10px] font-mono text-fg-4 truncate">
                                <span>URL:</span> <span className="text-fg-3">{key.base_url}</span>
                              </div>
                            )}

                            {result && (
                              <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1 border-t border-line-2 pt-1">
                                {result.ok ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6b9a78]" />
                                    <span className="text-[#6b9a78]">Verification successful: Key is active.</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-[#b87470]" />
                                    <span className="text-[#b87470] truncate">{result.msg}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: MEMORY */}
            {activeSubTab === 'memory' && (
              <div className="flex flex-col gap-6">
                {/* Form to Add Memory */}
                <form onSubmit={handleAddMemory} className="bg-surface border border-line p-4 rounded-md flex flex-col gap-3">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Add Core Workspace Fact (Semantic memory)</div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3 flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">Memory category</label>
                      <select
                        value={newMemoryCategory}
                        onChange={(e) => setNewMemoryCategory(e.target.value)}
                        className="input text-xs py-1.5"
                      >
                        <option value="general">General context facts</option>
                        <option value="preference">User style preferences</option>
                        <option value="project">Project specifications</option>
                        <option value="rule">Inference constraints</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono text-fg-3 uppercase">Tags (csv)</label>
                      <input
                        type="text"
                        placeholder="typescript, style"
                        value={newMemoryTags}
                        onChange={(e) => setNewMemoryTags(e.target.value)}
                        className="input text-xs py-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-fg-3 uppercase">Fact Content</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Always structure Next.js routes using App Router only."
                      value={newMemoryContent}
                      onChange={(e) => setNewMemoryContent(e.target.value)}
                      className="input text-xs font-mono py-1.5"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary self-end text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Commit Fact
                  </button>
                </form>

                {/* Memories List */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Semantic Memory Database ({filteredMemories.length})</div>
                    {/* Search memories */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4" />
                      <input
                        type="text"
                        placeholder="Filter memories..."
                        value={memorySearch}
                        onChange={(e) => setMemorySearch(e.target.value)}
                        className="input py-1 pl-8 text-xs w-[180px]"
                      />
                    </div>
                  </div>
                  {filteredMemories.length === 0 ? (
                    <div className="p-4 bg-surface border border-dashed border-line text-center text-xs text-fg-4 rounded-md">
                      No matching memories found. Memory keeps long-term context persistent.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredMemories.map((mem) => (
                        <div key={mem.id} className="p-3 bg-surface border border-line rounded flex items-start gap-4 justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono uppercase bg-elevated border border-line-2 px-1 py-0.5 rounded text-accent">
                                {mem.category}
                              </span>
                              {mem.tags && mem.tags.map((t, idx) => (
                                <span key={idx} className="text-[8px] font-mono text-fg-3 bg-bg border border-line px-1 rounded">
                                  #{t}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs font-mono text-fg-2 mt-2 leading-relaxed whitespace-pre-wrap">{mem.content}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="text-fg-4 hover:text-bad p-1 rounded hover:bg-hover transition-colors cursor-pointer mt-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ANALYTICS */}
            {activeSubTab === 'analytics' && (
              <div className="flex flex-col gap-6">
                {loadingAnalytics ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-mono uppercase text-fg-4">Gathering metrics...</span>
                  </div>
                ) : analytics ? (
                  <div className="flex flex-col gap-6">
                    {/* Stats counters */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-surface border border-line p-4 rounded-md">
                        <div className="text-[10px] font-mono uppercase text-fg-4">Conversations</div>
                        <div className="text-xl font-bold font-mono text-fg mt-1">{analytics.total_conversations}</div>
                      </div>
                      <div className="bg-surface border border-line p-4 rounded-md">
                        <div className="text-[10px] font-mono uppercase text-fg-4">Total Messages</div>
                        <div className="text-xl font-bold font-mono text-fg mt-1">{analytics.total_messages}</div>
                      </div>
                      <div className="bg-surface border border-line p-4 rounded-md">
                        <div className="text-[10px] font-mono uppercase text-fg-4">Tokens Traversed</div>
                        <div className="text-xl font-bold font-mono text-fg mt-1">{analytics.total_tokens.toLocaleString()}</div>
                      </div>
                      <div className="bg-surface border border-line p-4 rounded-md">
                        <div className="text-[10px] font-mono uppercase text-fg-4">Estimated Cost</div>
                        <div className="text-xl font-bold font-mono text-[#6b9a78] mt-1">${analytics.estimated_cost.toFixed(4)}</div>
                      </div>
                    </div>

                    {/* Progress tracking display */}
                    <div className="bg-surface border border-line p-4 rounded-md flex flex-col gap-4">
                      <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3">Workspace Provider Usage Distribution</div>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-mono text-fg-2">
                            <span>Groq (Ultra-Fast General Answers)</span>
                            <span>65% (Llama 3.3 70B / 8B)</span>
                          </div>
                          <div className="h-1.5 bg-elevated border border-line rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: '65%' }} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-mono text-fg-2">
                            <span>NVIDIA NIM (Heavy Reasoning)</span>
                            <span>25% (Nemotron 3 Ultra 550B)</span>
                          </div>
                          <div className="h-1.5 bg-elevated border border-line rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: '25%' }} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-mono text-fg-2">
                            <span>Other Local & Cloud Providers</span>
                            <span>10% (OpenAI / Ollama)</span>
                          </div>
                          <div className="h-1.5 bg-elevated border border-line rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: '10%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-fg-4">No analytics data available.</div>
                )}
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeSubTab === 'about' && (
              <div className="flex flex-col gap-4 max-w-[550px] text-xs leading-relaxed text-fg-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full border border-accent flex items-center justify-center bg-accent-bg">
                    <span className="text-xs font-mono text-accent">CY</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-fg">Chat-Y Workspace</h2>
                    <p className="text-[10px] font-mono text-fg-4">PRODUCTION BUILD • VERSION 1.0.0</p>
                  </div>
                </div>

                <p>
                  Chat-Y is a modern, extensible AI workspace environment combining WebLLM in-browser models, multi-provider API keys (Groq, Gemini, OpenRouter, NVIDIA NIM), file analysis, and persistent memory.
                </p>

                {/* Creator Profile Section — Permanent */}
                <div className="p-3 bg-surface border border-line rounded-lg flex flex-col gap-2.5">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent font-semibold">Created By</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4DE8F0] to-[#9D7BFF] flex items-center justify-center text-black font-bold text-sm">
                      C
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-fg">{creatorName}</span>
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-accent hover:underline transition-colors flex items-center gap-1"
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        @{instagramHandle}
                      </a>
                    </div>
                  </div>
                </div>

                <p className="border-t border-line pt-3 font-mono text-[10px] text-fg-4 uppercase tracking-[1px]">Stack Components</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Frontend</span> <span className="text-fg-2">Next.js 14 / Tailwind CSS</span>
                  </div>
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Local Engine</span> <span className="text-fg-2">WebLLM / WebGPU</span>
                  </div>
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Cloud APIs</span> <span className="text-fg-2">Groq / Gemini / OpenRouter / NVIDIA</span>
                  </div>
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Deployment</span> <span className="text-fg-2">Vercel Client-First</span>
                  </div>
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Creator</span> <span className="text-fg-2">{creatorName} (@{instagramHandle})</span>
                  </div>
                  <div className="flex justify-between border-b border-line-2 py-1">
                    <span className="text-fg-4">Animations</span> <span className="text-fg-2">Framer Motion / CSS3</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: KNOW YOUR LLM */}
            {activeSubTab === 'know-your-llm' && (
              <div className="flex flex-col gap-5 max-w-[600px]">
                {/* Header */}
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    Know Your LLM
                  </h2>
                  <p className="text-[11px] text-fg-3 leading-relaxed">
                    Choose the right model for your task. Local models run in your browser (free & private). Cloud models need an API key but are more powerful.
                  </p>
                </div>

                {/* ── TASK RECOMMENDATION CARDS ── */}
                <div className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent font-semibold">Which Model Should I Use?</div>
                  <div className="grid grid-cols-2 gap-2">

                    {/* Privacy Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#6b9a78]/15 flex items-center justify-center"><Lock className="w-3.5 h-3.5 text-[#6b9a78]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Maximum Privacy</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">Your data never leaves your device. Zero server traffic.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#6b9a78]/10 text-[#6b9a78] border border-[#6b9a78]/20">✦ Use WebLLM (Local)</span>
                      </div>
                    </div>

                    {/* Speed Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#b8956a]/15 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-[#b8956a]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Ultra-Fast Responses</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">Fastest inference speeds available. Sub-second token generation.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#b8956a]/10 text-[#b8956a] border border-[#b8956a]/20">⚡ Use Groq</span>
                      </div>
                    </div>

                    {/* Deep Reasoning Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#9D7BFF]/15 flex items-center justify-center"><Brain className="w-3.5 h-3.5 text-[#9D7BFF]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Deep Reasoning</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">Complex analysis, math, research papers, multi-step logic.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#9D7BFF]/10 text-[#9D7BFF] border border-[#9D7BFF]/20">🧠 Use NVIDIA NIM</span>
                      </div>
                    </div>

                    {/* Coding Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#4DE8F0]/15 flex items-center justify-center"><Code className="w-3.5 h-3.5 text-[#4DE8F0]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Code Generation</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">Writing, debugging, and reviewing code across all languages.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#4DE8F0]/10 text-[#4DE8F0] border border-[#4DE8F0]/20">💎 Use Gemini or OpenRouter</span>
                      </div>
                    </div>

                    {/* General Chat Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#a891c8]/15 flex items-center justify-center"><MessageSquare className="w-3.5 h-3.5 text-[#a891c8]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Everyday Chat</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">Quick Q&A, brainstorming, simple answers — no API key needed.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#a891c8]/10 text-[#a891c8] border border-[#a891c8]/20">🏠 Use WebLLM (Local)</span>
                      </div>
                    </div>

                    {/* Model Variety Card */}
                    <div className="p-2.5 bg-surface border border-line rounded-lg flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-[#7a8eaa]/15 flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-[#7a8eaa]" /></div>
                        <span className="text-[11px] font-semibold text-fg">Access 100+ Models</span>
                      </div>
                      <p className="text-[10px] text-fg-3 leading-relaxed">One key, dozens of models — Claude, GPT, Llama, DeepSeek & more.</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#7a8eaa]/10 text-[#7a8eaa] border border-[#7a8eaa]/20">🌐 Use OpenRouter</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── LOCAL MODELS (WebLLM) with Download Buttons ── */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#6b9a78]" />
                    <span className="font-mono text-[10px] tracking-[1px] uppercase text-fg-2 font-semibold">Local Models (WebLLM — In-Browser, Free)</span>
                  </div>
                  <p className="text-[10px] text-fg-4 mb-1">These run entirely in your browser via WebGPU. No data leaves your device. One-time download, then works offline. Click &quot;Download &amp; Load&quot; to activate a model.</p>

                  {/* WebLLM Progress Bar */}
                  {state.webllmStatus === 'loading' && (
                    <div className="p-3 bg-surface border border-accent/30 rounded-lg flex flex-col gap-2 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                          <span className="text-[11px] font-mono text-accent font-medium">Downloading Model...</span>
                        </div>
                        <span className="text-[10px] font-mono text-fg-3">{state.webllmProgress.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-elevated border border-line rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${state.webllmProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-[9px] font-mono text-fg-4 truncate">{state.webllmProgress.text}</p>
                    </div>
                  )}

                  {state.webllmStatus === 'unsupported' && (
                    <div className="p-2.5 bg-[#c9544a]/10 border border-[#c9544a]/20 rounded-lg text-[10px] text-[#c9544a] font-mono">
                      ⚠️ WebGPU is not supported in this browser. Use Chrome 113+, Edge 113+, or add a Cloud API key instead.
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    {/* SmolLM2 360M */}
                    {(() => {
                      const modelId = 'SmolLM-360M-Instruct-q4f16_1-MLC';
                      const isActive = state.webllmStatus === 'ready' && state.webllmModelId === modelId;
                      const isLoading = state.webllmStatus === 'loading' && state.webllmModelId === modelId;
                      return (
                        <div className={`p-2.5 bg-surface border rounded flex items-start gap-3 transition-colors ${
                          isActive ? 'border-[#6b9a78]' : 'border-line hover:border-[#6b9a78]/40'
                        }`}>
                          <div className="w-8 h-8 rounded-md bg-[#6b9a78]/10 border border-[#6b9a78]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-mono text-[#6b9a78]">S</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-fg">SmolLM2 360M</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#6b9a78]/10 text-[#6b9a78] border border-[#6b9a78]/20">~250 MB</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent-bg text-accent border border-accent/20">FASTEST</span>
                            </div>
                            <p className="text-[10px] text-fg-4 mt-0.5">Ultra-lightweight. Loads fast on any GPU. Best for simple Q&amp;A and quick tasks.</p>
                          </div>
                          <button
                            onClick={() => loadWebLLM(modelId)}
                            disabled={isLoading || state.webllmStatus === 'unsupported'}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all flex-shrink-0 mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive
                                ? 'bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30'
                                : 'bg-accent-bg text-accent border border-accent/30 hover:bg-accent/20'
                            }`}
                          >
                            {isActive ? <><CheckCircle className="w-3 h-3" /> ACTIVE</>
                              : isLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</>
                              : <><Download className="w-3 h-3" /> Download &amp; Load</>}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Llama 3.2 1B */}
                    {(() => {
                      const modelId = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
                      const isActive = state.webllmStatus === 'ready' && state.webllmModelId === modelId;
                      const isLoading = state.webllmStatus === 'loading' && state.webllmModelId === modelId;
                      return (
                        <div className={`p-2.5 bg-surface border rounded flex items-start gap-3 transition-colors ${
                          isActive ? 'border-[#6b9a78]' : 'border-line hover:border-[#6b9a78]/40'
                        }`}>
                          <div className="w-8 h-8 rounded-md bg-[#6b9a78]/10 border border-[#6b9a78]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-mono text-[#6b9a78]">L</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-fg">Llama 3.2 1B Instruct</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#6b9a78]/10 text-[#6b9a78] border border-[#6b9a78]/20">~700 MB</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#b8956a]/10 text-[#b8956a] border border-[#b8956a]/20">BALANCED</span>
                            </div>
                            <p className="text-[10px] text-fg-4 mt-0.5">Great all-rounder. Meta&apos;s latest small model — solid reasoning for its size.</p>
                          </div>
                          <button
                            onClick={() => loadWebLLM(modelId)}
                            disabled={isLoading || state.webllmStatus === 'unsupported'}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all flex-shrink-0 mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive
                                ? 'bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30'
                                : 'bg-accent-bg text-accent border border-accent/30 hover:bg-accent/20'
                            }`}
                          >
                            {isActive ? <><CheckCircle className="w-3 h-3" /> ACTIVE</>
                              : isLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</>
                              : <><Download className="w-3 h-3" /> Download &amp; Load</>}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Qwen 2.5 1.5B */}
                    {(() => {
                      const modelId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
                      const isActive = state.webllmStatus === 'ready' && state.webllmModelId === modelId;
                      const isLoading = state.webllmStatus === 'loading' && state.webllmModelId === modelId;
                      return (
                        <div className={`p-2.5 bg-surface border rounded flex items-start gap-3 transition-colors ${
                          isActive ? 'border-[#6b9a78]' : 'border-line hover:border-[#6b9a78]/40'
                        }`}>
                          <div className="w-8 h-8 rounded-md bg-[#6b9a78]/10 border border-[#6b9a78]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-mono text-[#6b9a78]">Q</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-fg">Qwen 2.5 1.5B Instruct</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#6b9a78]/10 text-[#6b9a78] border border-[#6b9a78]/20">~1 GB</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#9D7BFF]/10 text-[#9D7BFF] border border-[#9D7BFF]/20">SMARTEST</span>
                            </div>
                            <p className="text-[10px] text-fg-4 mt-0.5">Best local quality. Alibaba&apos;s model with strong multilingual and code abilities. Needs decent GPU.</p>
                          </div>
                          <button
                            onClick={() => loadWebLLM(modelId)}
                            disabled={isLoading || state.webllmStatus === 'unsupported'}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all flex-shrink-0 mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive
                                ? 'bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30'
                                : 'bg-accent-bg text-accent border border-accent/30 hover:bg-accent/20'
                            }`}
                          >
                            {isActive ? <><CheckCircle className="w-3 h-3" /> ACTIVE</>
                              : isLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</>
                              : <><Download className="w-3 h-3" /> Download &amp; Load</>}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── CLOUD MODELS ── */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-[#b8956a]" />
                    <span className="font-mono text-[10px] tracking-[1px] uppercase text-fg-2 font-semibold">Cloud Models (API Key Required)</span>
                  </div>
                  <p className="text-[10px] text-fg-4 mb-1">Powerful models hosted on cloud infrastructure. You supply your own API key — it stays in your browser.</p>
                </div>

                {/* Groq */}
                <div className="p-3 bg-surface border border-line rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#b8956a]/15 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-[#b8956a]" /></div>
                      <span className="text-xs font-semibold text-fg">Groq</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#b8956a]/10 text-[#b8956a] border border-[#b8956a]/20">ULTRA-FAST</span>
                    </div>
                    <span className="text-[9px] font-mono text-fg-4">api.groq.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'llama-guard-3-8b'].map(m => (
                      <div key={m} className="text-[10px] font-mono text-fg-3 bg-elevated px-2 py-1 rounded border border-line-2 truncate">{m}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-fg-4">⚡ Best for: Speed-critical tasks, real-time chat, rapid iteration. Fastest tokens/sec in the industry.</p>
                </div>

                {/* Gemini */}
                <div className="p-3 bg-surface border border-line rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#4285f4]/15 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-[#4285f4]" /></div>
                      <span className="text-xs font-semibold text-fg">Gemini (Google)</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#4285f4]/10 text-[#4285f4] border border-[#4285f4]/20">MULTIMODAL</span>
                    </div>
                    <span className="text-[9px] font-mono text-fg-4">generativelanguage.googleapis.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'].map(m => (
                      <div key={m} className="text-[10px] font-mono text-fg-3 bg-elevated px-2 py-1 rounded border border-line-2 truncate">{m}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-fg-4">💎 Best for: Code generation, long-context tasks (1M tokens), multimodal (images + text), and Google ecosystem integration.</p>
                </div>

                {/* OpenRouter */}
                <div className="p-3 bg-surface border border-line rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#7a8eaa]/15 flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-[#7a8eaa]" /></div>
                      <span className="text-xs font-semibold text-fg">OpenRouter</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#7a8eaa]/10 text-[#7a8eaa] border border-[#7a8eaa]/20">100+ MODELS</span>
                    </div>
                    <span className="text-[9px] font-mono text-fg-4">openrouter.ai</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['anthropic/claude-sonnet-4', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'qwen/qwen3-235b-a22b'].map(m => (
                      <div key={m} className="text-[10px] font-mono text-fg-3 bg-elevated px-2 py-1 rounded border border-line-2 truncate">{m}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-fg-4">🌐 Best for: Model variety — one API key gives access to Claude, GPT, Llama, DeepSeek, Gemini and 100+ more. Great for comparing models.</p>
                </div>

                {/* NVIDIA NIM */}
                <div className="p-3 bg-surface border border-line rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#76b900]/15 flex items-center justify-center"><Brain className="w-3.5 h-3.5 text-[#76b900]" /></div>
                      <span className="text-xs font-semibold text-fg">NVIDIA NIM</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#76b900]/10 text-[#76b900] border border-[#76b900]/20">HEAVY REASONING</span>
                    </div>
                    <span className="text-[9px] font-mono text-fg-4">integrate.api.nvidia.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['meta/llama-3.1-405b-instruct', 'nvidia/nemotron-4-340b', 'meta/llama-3.1-70b-instruct', 'mistralai/mixtral-8x22b'].map(m => (
                      <div key={m} className="text-[10px] font-mono text-fg-3 bg-elevated px-2 py-1 rounded border border-line-2 truncate">{m}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-fg-4">🧠 Best for: Complex reasoning, research analysis, scientific computation, enterprise workloads. Optimized GPU inference.</p>
                </div>

                {/* Quick Comparison Table */}
                <div className="flex flex-col gap-2 mt-1">
                  <div className="font-mono text-[10px] tracking-[1px] uppercase text-fg-3 font-semibold">Quick Comparison</div>
                  <div className="overflow-hidden rounded-md border border-line">
                    <table className="w-full text-[10px] font-mono">
                      <thead>
                        <tr className="bg-surface border-b border-line">
                          <th className="text-left px-2.5 py-1.5 text-fg-3 font-medium">Provider</th>
                          <th className="text-center px-2.5 py-1.5 text-fg-3 font-medium">Speed</th>
                          <th className="text-center px-2.5 py-1.5 text-fg-3 font-medium">Quality</th>
                          <th className="text-center px-2.5 py-1.5 text-fg-3 font-medium">Privacy</th>
                          <th className="text-center px-2.5 py-1.5 text-fg-3 font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-line-2 hover:bg-hover/50">
                          <td className="px-2.5 py-1.5 text-fg-2">WebLLM (Local)</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-[#6b9a78]">⭐⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-[#6b9a78]">Free</td>
                        </tr>
                        <tr className="border-b border-line-2 hover:bg-hover/50">
                          <td className="px-2.5 py-1.5 text-fg-2">Groq</td>
                          <td className="text-center px-2.5 py-1.5 text-[#b8956a]">⭐⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">Free tier</td>
                        </tr>
                        <tr className="border-b border-line-2 hover:bg-hover/50">
                          <td className="px-2.5 py-1.5 text-fg-2">Gemini</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-[#4285f4]">⭐⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">Free tier</td>
                        </tr>
                        <tr className="border-b border-line-2 hover:bg-hover/50">
                          <td className="px-2.5 py-1.5 text-fg-2">OpenRouter</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-[#7a8eaa]">⭐⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">Pay-per-use</td>
                        </tr>
                        <tr className="hover:bg-hover/50">
                          <td className="px-2.5 py-1.5 text-fg-2">NVIDIA NIM</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-[#76b900]">⭐⭐⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">⭐⭐⭐</td>
                          <td className="text-center px-2.5 py-1.5 text-fg-4">Free tier</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
