'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { X, Search, Check, Zap, Brain, Sparkles, Monitor, Shield, Download, Loader2 } from 'lucide-react';

interface ModelPickerModalProps {
  onClose: () => void;
}

export function ModelPickerModal({ onClose }: ModelPickerModalProps) {
  const { state, dispatch, showToast } = useApp();
  const { activeModel, models } = state;
  const [searchQuery, setSearchQuery] = useState('');

  // Local WebLLM models
  const webllmModels = [
    { name: 'SmolLM2 360M', provider: 'webllm', model_id: 'SmolLM-360M-Instruct-q4f16_1-MLC', description: '✦ In-Browser Local Model (~250 MB). Zero data sent to servers.' },
    { name: 'Llama 3.2 1B Instruct', provider: 'webllm', model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', description: '✦ In-Browser Local Model (~700 MB). Meta reasoning on device.' },
    { name: 'Qwen 2.5 1.5B Instruct', provider: 'webllm', model_id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', description: '✦ In-Browser Local Model (~1 GB). Strong local code & reasoning.' },
  ];

  // Fallback default models if DB models list is empty
  const defaultModels = [
    ...webllmModels,
    { name: 'Llama 3.3 70B Versatile', provider: 'groq', model_id: 'llama-3.3-70b-versatile', description: 'Ultra-fast general answers' },
    { name: 'Llama 3.1 8B Instant', provider: 'groq', model_id: 'llama-3.1-8b-instant', description: 'Absolute fastest response speed' },
    { name: 'Nemotron 3 Ultra 550B', provider: 'nvidia_nim', model_id: 'nvidia/nemotron-3-ultra-550b-a55b', description: 'NVIDIA high-performance reasoning' },
    { name: 'GPT-4o', provider: 'openai', model_id: 'gpt-4o', description: 'OpenAI flagship multimodal intelligence' },
    { name: 'GPT-4o Mini', provider: 'openai', model_id: 'gpt-4o-mini', description: 'Fast, lightweight reasoning' },
    { name: 'Claude 3.5 Sonnet', provider: 'anthropic', model_id: 'claude-3-5-sonnet-20241022', description: 'Excellent coding and reasoning' },
    { name: 'Gemini 1.5 Pro', provider: 'google', model_id: 'gemini/gemini-1.5-pro', description: 'Massive context window analysis' },
    { name: 'Gemini 1.5 Flash', provider: 'google', model_id: 'gemini/gemini-1.5-flash', description: 'Google speed-tier multimodal' },
  ];

  // Map state models to picker format
  const dbModels = [
    ...webllmModels,
    ...models.map(m => ({
      name: m.name,
      provider: m.provider,
      model_id: m.model_id,
      description: m.description || `Custom ${m.provider} model config`,
    }))
  ];

  const allModels = dbModels.length > 3 ? dbModels : defaultModels;

  const { loadWebLLM } = useApp();

  const handleSelectModel = (provider: string, modelId: string) => {
    const modelString = `${provider}/${modelId}`;
    dispatch({ type: 'SET_MODEL', payload: modelString });

    if (provider === 'webllm') {
      dispatch({ type: 'SET_CHAT_MODE', payload: 'local' });
      dispatch({ type: 'SET_WEBLLM_MODEL_ID', payload: modelId });
      loadWebLLM(modelId);
      showToast(`Switched to Local WebLLM (${modelId})`, 'info');
    } else {
      dispatch({ type: 'SET_CHAT_MODE', payload: 'cloud' });
      showToast(`Switched model to ${modelId}`, 'success');
    }
    onClose();
  };

  const getModelString = (provider: string, modelId: string) => {
    return `${provider}/${modelId}`;
  };

  // Group models by provider
  const groupedModels = allModels.reduce<Record<string, typeof allModels>>((acc, m) => {
    if (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.model_id.toLowerCase().includes(searchQuery.toLowerCase())) {
      if (!acc[m.provider]) acc[m.provider] = [];
      acc[m.provider].push(m);
    }
    return acc;
  }, {});

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'webllm': return <Shield className="w-3.5 h-3.5 text-[#6b9a78]" />;
      case 'groq': return <Zap className="w-3.5 h-3.5 text-[#b8956a]" />;
      case 'nvidia_nim': return <Brain className="w-3.5 h-3.5 text-[#7a8eaa]" />;
      case 'openai': return <Sparkles className="w-3.5 h-3.5 text-[#6b9a78]" />;
      case 'ollama': return <Monitor className="w-3.5 h-3.5 text-[#6b9a78]" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-accent" />;
    }
  };

  const getSpeedBadge = (provider: string) => {
    if (provider === 'webllm') {
      return (
        <span className="text-[8px] font-mono uppercase bg-[#6b9a78]/15 text-[#6b9a78] border border-[#6b9a78]/30 px-1 rounded">
          ✦ WebGPU Private
        </span>
      );
    }
    if (provider === 'groq') {
      return (
        <span className="text-[8px] font-mono uppercase bg-[#b8956a]/15 text-[#b8956a] border border-[#b8956a]/30 px-1 rounded">
          ⚡ Fast
        </span>
      );
    }
    if (provider === 'nvidia_nim') {
      return (
        <span className="text-[8px] font-mono uppercase bg-[#7a8eaa]/15 text-[#7a8eaa] border border-[#7a8eaa]/30 px-1 rounded">
          🧠 reasoning
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4">
      {/* Modal Dialog */}
      <div className="w-full max-w-[420px] max-h-[500px] bg-surface border border-line rounded-lg shadow-xl flex flex-col overflow-hidden animate-[fadeIn_150ms_ease]">
        {/* Header */}
        <div className="h-11 border-b border-line flex items-center justify-between px-4 bg-surface flex-shrink-0">
          <span className="font-mono text-xs text-fg uppercase font-semibold">Select AI Model</span>
          <button
            onClick={onClose}
            className="text-fg-4 hover:text-fg transition-colors p-1 rounded hover:bg-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-line bg-bg flex-shrink-0 relative">
          <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-fg-4" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-9 py-1.5 text-xs"
            autoFocus
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-2.5 bg-bg flex flex-col gap-3">
          {Object.keys(groupedModels).length === 0 ? (
            <div className="p-6 text-center text-xs text-fg-4">No matching models found.</div>
          ) : (
            Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 px-2 py-1 font-mono text-[9px] tracking-[1.5px] uppercase text-fg-4 border-b border-line-2/40">
                  {getProviderIcon(provider)}
                  {provider.replace('_', ' ')}
                </div>
                
                <div className="flex flex-col gap-0.5 mt-1">
                  {providerModels.map((model) => {
                    const modelStr = getModelString(model.provider, model.model_id);
                    const isSelected = activeModel === modelStr;

                    return (
                      <button
                        key={model.model_id}
                        onClick={() => handleSelectModel(model.provider, model.model_id)}
                        className={`flex items-start justify-between p-2 rounded-md text-left transition-colors cursor-pointer w-full border border-transparent ${
                          isSelected
                            ? 'bg-accent-bg border-accent-bd text-accent'
                            : 'hover:bg-surface hover:border-line text-fg-2 hover:text-fg'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold flex items-center gap-2">
                            {model.name}
                            {getSpeedBadge(model.provider)}
                          </div>
                          <div className="text-[10px] font-mono text-fg-4 truncate mt-0.5" title={model.model_id}>
                            {model.model_id}
                          </div>
                          <div className="text-[10px] text-fg-3 leading-normal mt-1 font-sans">
                            {model.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0 mt-0.5 text-accent">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
