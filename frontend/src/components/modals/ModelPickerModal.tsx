'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { X, Search, Check, Zap, Brain, Sparkles, Monitor, Shield, Download, Loader2 } from 'lucide-react';

interface ModelPickerModalProps {
  onClose: () => void;
}

export function ModelPickerModal({ onClose }: ModelPickerModalProps) {
  const { state, dispatch, showToast } = useApp();
  const { activeModel, models } = state;
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
      case 'webllm': return <Shield size={13} style={{ color: '#6b9a78' }} />;
      case 'groq': return <Zap size={13} style={{ color: '#b8956a' }} />;
      case 'nvidia_nim': return <Brain size={13} style={{ color: '#7a8eaa' }} />;
      case 'openai': return <Sparkles size={13} style={{ color: '#6b9a78' }} />;
      case 'ollama': return <Monitor size={13} style={{ color: '#6b9a78' }} />;
      default: return <Sparkles size={13} style={{ color: 'var(--accent)' }} />;
    }
  };

  const getSpeedBadge = (provider: string) => {
    if (provider === 'webllm') {
      return (
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: 'rgba(107,154,120,0.12)', color: '#6b9a78', border: '1px solid rgba(107,154,120,0.25)', padding: '1px 4px', borderRadius: 3 }}>
          ✦ WebGPU Private
        </span>
      );
    }
    if (provider === 'groq') {
      return (
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: 'rgba(184,149,106,0.12)', color: '#b8956a', border: '1px solid rgba(184,149,106,0.25)', padding: '1px 4px', borderRadius: 3 }}>
          ⚡ Fast
        </span>
      );
    }
    if (provider === 'nvidia_nim') {
      return (
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: 'rgba(122,142,170,0.12)', color: '#7a8eaa', border: '1px solid rgba(122,142,170,0.25)', padding: '1px 4px', borderRadius: 3 }}>
          🧠 Reasoning
        </span>
      );
    }
    return null;
  };

  const modalContent = (
    <>
      {/* Header */}
      <div style={{
        height: 48,
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Select AI Model
        </span>
        <button
          onClick={onClose}
          className="touch-btn"
          style={{
            color: 'var(--fg-4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--fg)';
            e.currentTarget.style.background = 'var(--hover)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--fg-4)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--line)', background: 'var(--bg)', flexShrink: 0, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-4)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input"
          style={{ paddingLeft: 36, fontSize: 12, height: 36 }}
          autoFocus={!isMobile}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' }}>
        {Object.keys(groupedModels).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--fg-4)' }}>No matching models found.</div>
        ) : (
          Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--fg-4)',
                borderBottom: '1px solid rgba(31,31,31,0.5)',
              }}>
                {getProviderIcon(provider)}
                {provider.replace('_', ' ')}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {providerModels.map((model) => {
                  const modelStr = getModelString(model.provider, model.model_id);
                  const isSelected = activeModel === modelStr;

                  return (
                    <button
                      key={model.model_id}
                      onClick={() => handleSelectModel(model.provider, model.model_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '10px 10px',
                        borderRadius: 8,
                        textAlign: 'left',
                        cursor: 'pointer',
                        width: '100%',
                        border: isSelected ? '1px solid var(--accent-bd)' : '1px solid transparent',
                        background: isSelected ? 'var(--accent-bg)' : 'none',
                        color: isSelected ? 'var(--accent)' : 'var(--fg-2)',
                        transition: 'all 150ms ease',
                        minHeight: 48,
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--surface)';
                          e.currentTarget.style.borderColor = 'var(--line)';
                          e.currentTarget.style.color = 'var(--fg)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.color = 'var(--fg-2)';
                        }
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: 8, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {model.name}
                          {getSpeedBadge(model.provider)}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }} title={model.model_id}>
                          {model.model_id}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4, marginTop: 3 }}>
                          {model.description}
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }}>
                          <Check size={16} />
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
    </>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <>
        <div
          onClick={onClose}
          className="fixed inset-0 z-[100]"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        />
        <div
          className="fixed bottom-0 left-0 right-0 z-[101] animate-slide-up-sheet safe-area-bottom"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--line)',
            borderRadius: '16px 16px 0 0',
            maxHeight: '80dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-3)' }} />
          </div>
          {modalContent}
        </div>
      </>
    );
  }

  // Desktop: centered modal
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: 520,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {modalContent}
      </div>
    </div>
  );
}
