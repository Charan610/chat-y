'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  ChevronDown,
  Zap,
  Brain,
  Globe,
  Settings,
  Check,
  Search,
  User,
  Copy,
  Key
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { ModelPickerModal } from '@/components/modals/ModelPickerModal';

const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  webllm: { label: '✦ WEB-GPU', color: '#6b9a78' },
  groq: { label: '⚡ FAST', color: '#b8956a' },
  nvidia: { label: '🧠 REASONING', color: '#7a8eaa' },
  nvidia_nim: { label: '🧠 REASONING', color: '#7a8eaa' },
  openai: { label: 'GPT', color: '#6b9a78' },
  anthropic: { label: 'CLAUDE', color: '#a891c8' },
  google: { label: 'GEMINI', color: '#7a8eaa' },
  ollama: { label: 'LOCAL', color: '#6b9a78' },
};

function getProvider(model: string) {
  return model.split('/')[0]?.toLowerCase() || '';
}

function getModelDisplay(model: string) {
  const parts = model.split('/');
  return parts[parts.length - 1] || model;
}

export function TopNav() {
  const { state, dispatch, renameConv } = useApp();
  const { activeConversationId, conversations, activeModel, webSearchEnabled, sidebarOpen } = state;
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // User Profile state
  const userName = typeof window !== 'undefined' ? localStorage.getItem('chaty_user_name') || 'User' : 'User';
  const userId = typeof window !== 'undefined' ? localStorage.getItem('chaty_user_id') || '25b91a05d8' : '25b91a05d8';

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const provider = getProvider(activeModel);
  const badge = PROVIDER_BADGES[provider];

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  const startEdit = () => {
    setTitleInput(activeConv?.title || 'New Chat');
    setEditingTitle(true);
  };

  const commitEdit = () => {
    if (activeConversationId && titleInput.trim()) {
      renameConv(activeConversationId, titleInput.trim());
    }
    setEditingTitle(false);
  };

  return (
    <>
      <header
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fg-3)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            flexShrink: 0,
            transition: 'color 120ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-3)')}
        >
          <Menu size={16} />
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--accent-bd)',
                borderRadius: 4,
                color: 'var(--fg)',
                fontSize: 14,
                fontWeight: 500,
                padding: '2px 8px',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                maxWidth: 320,
              }}
            />
          ) : (
            <button
              onClick={activeConv ? startEdit : undefined}
              style={{
                background: 'none',
                border: 'none',
                color: activeConv ? 'var(--fg)' : 'var(--fg-4)',
                fontSize: 14,
                fontWeight: 500,
                cursor: activeConv ? 'text' : 'default',
                padding: '2px 4px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 300,
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => activeConv && (e.currentTarget.style.background = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {activeConv?.title || (activeConversationId ? 'Chat' : 'Chat-Y')}
            </button>
          )}

          {/* Model badge */}
          {badge && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: badge.color,
                background: `${badge.color}18`,
                border: `1px solid ${badge.color}40`,
                borderRadius: 3,
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              {badge.label}
            </span>
          )}
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Web Search Toggle */}
          <button
            id="web-search-toggle"
            onClick={() => dispatch({ type: 'TOGGLE_WEB_SEARCH' })}
            title="Toggle web search"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              borderRadius: 5,
              border: `1px solid ${webSearchEnabled ? 'var(--accent-bd)' : 'var(--line-2)'}`,
              background: webSearchEnabled ? 'var(--accent-bg)' : 'none',
              color: webSearchEnabled ? 'var(--accent)' : 'var(--fg-4)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              transition: 'all 120ms',
            }}
          >
            <Globe size={13} />
            {webSearchEnabled && <span>WEB</span>}
          </button>

          {/* Model Selector */}
          <button
            id="model-selector-btn"
            onClick={() => setShowModelPicker(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--line-2)',
              background: 'var(--elevated)',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              transition: 'all 120ms',
              maxWidth: 200,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--line-3)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--line-2)';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getModelDisplay(activeModel)}
            </span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>

          {/* Settings */}
          <button
            onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', payload: true })}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-4)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              transition: 'color 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-4)')}
          >
            <Settings size={15} />
          </button>

          {/* Avatar */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-bd)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={`${userName} (${userId})`}
            >
              {userName.charAt(0).toUpperCase()}
            </button>

            {/* Profile Popover */}
            {showProfile && (
              <div
                className="absolute right-0 top-9 w-60 bg-surface border border-line rounded-lg shadow-xl p-3 flex flex-col gap-2.5 z-50 animate-[fadeIn_100ms_ease]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2.5 pb-2 border-b border-line">
                  <div className="w-8 h-8 rounded-full bg-accent-bg border border-accent-bd flex items-center justify-center font-bold text-accent font-mono text-xs">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-fg truncate">{userName}</span>
                    <span className="text-[10px] text-fg-4 font-mono">Workspace User</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-fg-4 uppercase tracking-[1px]">Unique User ID</span>
                  <div className="flex items-center gap-1.5 p-1.5 bg-bg border border-line rounded font-mono text-[11px]">
                    <Key className="w-3 h-3 text-accent flex-shrink-0" />
                    <span className="text-accent font-semibold flex-1 truncate">{userId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(userId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      className="p-1 hover:bg-hover text-fg-4 hover:text-fg rounded transition-colors cursor-pointer"
                      title="Copy User ID"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-[#6b9a78]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfile(false);
                    dispatch({ type: 'SET_SETTINGS_OPEN', payload: true });
                  }}
                  className="btn btn-secondary text-[11px] py-1 text-center w-full mt-0.5"
                >
                  Workspace Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showModelPicker && (
        <ModelPickerModal onClose={() => setShowModelPicker(false)} />
      )}
    </>
  );
}
