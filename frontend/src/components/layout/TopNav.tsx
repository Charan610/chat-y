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
  Key,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { ModelPickerModal } from '@/components/modals/ModelPickerModal';
import { UserProfileButton } from '@/components/auth/UserProfileButton';

const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  webllm: { label: '✦ LOCAL', color: '#6b9a78' },
  groq: { label: '⚡ FAST', color: '#FF8A3D' },
  nvidia: { label: '🧠 REASON', color: '#FF8A3D' },
  nvidia_nim: { label: '🧠 REASON', color: '#FF8A3D' },
  openai: { label: 'GPT', color: '#6b9a78' },
  anthropic: { label: 'CLAUDE', color: '#FF8A3D' },
  google: { label: 'GEMINI', color: '#FF8A3D' },
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
  const profileRef = useRef<HTMLDivElement>(null);

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

  // Close profile popover on outside click
  useEffect(() => {
    if (!showProfile) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfile]);

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
        className="glass"
        style={{
          height: 'var(--nav-height)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          borderBottom: '1px solid var(--line)',
          background: 'rgba(17, 17, 17, 0.85)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="touch-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fg-3)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            flexShrink: 0,
            transition: 'color 150ms ease, background 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--fg)';
            e.currentTarget.style.background = 'var(--hover)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--fg-3)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <Menu size={17} />
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                borderRadius: 6,
                color: 'var(--fg)',
                fontSize: 13,
                fontWeight: 500,
                padding: '4px 8px',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                maxWidth: 200,
                width: '100%',
              }}
            />
          ) : (
            <button
              onClick={activeConv ? startEdit : undefined}
              style={{
                background: 'none',
                border: 'none',
                color: activeConv ? 'var(--fg)' : 'var(--fg-4)',
                fontSize: 13,
                fontWeight: 500,
                cursor: activeConv ? 'text' : 'default',
                padding: '4px 6px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 180,
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => activeConv && (e.currentTarget.style.background = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {activeConv?.title || (activeConversationId ? 'Chat' : 'Chat-Y')}
            </button>
          )}

          {/* Model badge (desktop only) */}
          {badge && (
            <span
              className="hidden md:inline-flex"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: badge.color,
                background: `${badge.color}12`,
                border: `1px solid ${badge.color}30`,
                borderRadius: 4,
                padding: '2px 6px',
                flexShrink: 0,
                alignItems: 'center',
              }}
            >
              {badge.label}
            </span>
          )}
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {/* Web Search Toggle */}
          <button
            id="web-search-toggle"
            onClick={() => dispatch({ type: 'TOGGLE_WEB_SEARCH' })}
            title="Toggle web search"
            className="touch-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderRadius: 8,
              border: `1px solid ${webSearchEnabled ? 'var(--accent-bd)' : 'var(--line-2)'}`,
              background: webSearchEnabled ? 'var(--accent-bg)' : 'transparent',
              color: webSearchEnabled ? 'var(--accent)' : 'var(--fg-4)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              transition: 'all 200ms ease',
            }}
          >
            <Globe size={14} />
            {webSearchEnabled && <span className="hidden sm:inline">WEB</span>}
          </button>

          {/* Model Selector */}
          <button
            id="model-selector-btn"
            onClick={() => setShowModelPicker(true)}
            className="touch-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderRadius: 8,
              border: '1px solid var(--line-2)',
              background: 'var(--elevated)',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              transition: 'all 200ms ease',
              maxWidth: 120,
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
            <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
          </button>

          {/* User Persona & Profile Management */}
          <UserProfileButton />

          {/* Settings button */}
          <button
            onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', payload: true })}
            className="touch-btn hidden sm:flex"
            title="Workspace Settings"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-4)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              transition: 'color 150ms ease, background 150ms ease',
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
            <Settings size={15} />
          </button>
        </div>
      </header>

      {showModelPicker && (
        <ModelPickerModal onClose={() => setShowModelPicker(false)} />
      )}
    </>
  );
}
