'use client';

import React from 'react';
import {
  Zap,
  Globe,
  FileText,
  Code2,
  Search,
  Bug,
  BookOpen,
  Cpu,
  Upload,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';

const QUICK_PROMPTS = [
  { icon: Cpu, label: 'Explain quantum computing', prompt: 'Explain quantum computing in simple terms with a real-world example.' },
  { icon: Code2, label: 'Write a Python script', prompt: 'Write a Python script that reads a CSV file and produces a summary statistics report.' },
  { icon: Globe, label: 'Search the web', prompt: 'What are the latest developments in AI this week? Search the web for recent news.' },
  { icon: FileText, label: 'Analyze a file', prompt: 'I have a file I want you to analyze. Please help me understand its structure and contents.' },
  { icon: Bug, label: 'Debug my code', prompt: 'Help me debug this code. I\'ll paste it below — please identify any issues and suggest fixes.' },
  { icon: BookOpen, label: 'Summarize a document', prompt: 'I\'ll share a document. Please summarize it with key points, main arguments, and conclusions.' },
];

const PROVIDERS = [
  { id: 'groq', label: 'Groq', color: '#b8956a' },
  { id: 'nvidia', label: 'NVIDIA', color: '#6b9a78' },
  { id: 'openai', label: 'OpenAI', color: '#a891c8' },
  { id: 'anthropic', label: 'Anthropic', color: '#7a8eaa' },
];

export function WelcomeScreen() {
  const { state, user, newConversation, dispatch } = useApp();
  const { conversations, activeModel } = state;

  const recentConvs = conversations.slice(0, 3);

  return (
    <div
      className="flex flex-col items-center justify-center h-full overflow-auto w-full"
      style={{ padding: 'var(--chat-padding)' }}
    >
      <div style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Orb */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div
              className="animate-breathe"
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: '50%',
                background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, rgba(122,142,170,0.9) 0%, rgba(93,117,147,0.6) 60%, transparent 100%)',
                border: '1px solid rgba(122,142,170,0.3)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.35)',
                filter: 'blur(4px)',
              }}
            />
          </div>

          <div>
            <h1
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(22px, 5vw, 28px)',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: 'var(--fg)',
                margin: 0,
              }}
            >
              CHAT-Y
            </h1>
            <p style={{ color: 'var(--fg-3)', margin: '4px 0 0', fontSize: 14 }}>
              Your AI Workspace
            </p>
          </div>

          {!user && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface border border-line text-xs w-full max-w-[420px] text-fg-3 shadow-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate">Sign in with Google to save your chats across devices.</span>
              </div>
              <GoogleAuthButton />
            </div>
          )}

          {/* Start New Chat Button */}
          <button
            onClick={() => newConversation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: '0 4px 16px rgba(122,142,170,0.25)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(122,142,170,0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(122,142,170,0.25)';
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          >
            <Zap size={15} />
            <span>Start New Chat</span>
          </button>
        </div>

        {/* Quick Prompts — responsive grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
            width: '100%',
          }}
        >
          {QUICK_PROMPTS.map(item => (
            <button
              key={item.label}
              onClick={() => newConversation(item.prompt)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: 'var(--surface)',
                textAlign: 'left',
                transition: 'all 200ms ease',
                color: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-bd)';
                e.currentTarget.style.background = 'var(--elevated)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <item.icon size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.4 }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Recent Conversations */}
        {recentConvs.length > 0 && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              RECENT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentConvs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--fg-2)',
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'all 200ms ease',
                    minHeight: 44,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--elevated)';
                    e.currentTarget.style.color = 'var(--fg)';
                    e.currentTarget.style.borderColor = 'var(--line-2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface)';
                    e.currentTarget.style.color = 'var(--fg-2)';
                    e.currentTarget.style.borderColor = 'var(--line)';
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title || 'Untitled Chat'}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', flexShrink: 0 }}>
                    {conv.message_count} msg
                  </span>
                  <ChevronRight size={13} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Provider Status Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '8px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--fg-4)' }}>PROVIDERS</span>
          {PROVIDERS.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                className="animate-pulse2"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: p.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'var(--fg-3)' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
