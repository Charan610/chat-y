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
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';

const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  webllm: { label: '✦ LOCAL', color: '#6b9a78' },
  groq: { label: '⚡ FAST', color: '#b8956a' },
  nvidia: { label: '🧠 REASON', color: '#7a8eaa' },
  nvidia_nim: { label: '🧠 REASON', color: '#7a8eaa' },
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

          {/* Google Auth & User Session */}
          <GoogleAuthButton />

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

          {/* Avatar */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="touch-btn"
              style={{
                width: 30,
                height: 30,
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
                transition: 'transform 150ms ease, box-shadow 150ms ease',
              }}
              title={`${userName} (${userId})`}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,142,170,0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </button>

            {/* Profile Popover */}
            {showProfile && (
              <div
                className="animate-fade-in-scale"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 40,
                  width: 240,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  zIndex: 50,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent-bd)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    flexShrink: 0,
                  }}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>Workspace User</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '1px', textTransform: 'uppercase' }}>User ID</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}>
                    <Key size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--accent)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(userId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      style={{
                        padding: 4,
                        background: 'none',
                        border: 'none',
                        color: copiedId ? 'var(--ok)' : 'var(--fg-4)',
                        cursor: 'pointer',
                        borderRadius: 4,
                        display: 'flex',
                        transition: 'all 150ms ease',
                      }}
                      title="Copy User ID"
                    >
                      {copiedId ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfile(false);
                    dispatch({ type: 'SET_SETTINGS_OPEN', payload: true });
                  }}
                  className="btn"
                  style={{ justifyContent: 'center', fontSize: 11, marginTop: 2 }}
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
