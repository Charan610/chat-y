'use client';

import React from 'react';
import {
  Zap,
  Globe,
  FileText,
  Code2,
  Bug,
  BookOpen,
  Cpu,
  ChevronRight,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

const QUICK_PROMPTS = [
  { icon: Cpu, label: 'Explain quantum computing', prompt: 'Explain quantum computing in simple terms with a real-world example.' },
  { icon: Code2, label: 'Write a Python script', prompt: 'Write a Python script that reads a CSV file and produces a summary statistics report.' },
  { icon: Globe, label: 'Search the web', prompt: 'What are the latest developments in AI this week? Search the web for recent news.' },
  { icon: FileText, label: 'Analyze a file', prompt: 'I have a file I want you to analyze. Please help me understand its structure and contents.' },
  { icon: Bug, label: 'Debug my code', prompt: 'Help me debug this code. I\'ll paste it below — please identify any issues and suggest fixes.' },
  { icon: BookOpen, label: 'Summarize a document', prompt: 'I\'ll share a document. Please summarize it with key points, main arguments, and conclusions.' },
];

const PROVIDERS = [
  { id: 'groq', label: 'Groq', color: '#FF8A3D' },
  { id: 'webllm', label: 'WebLLM', color: '#6b9a78' },
  { id: 'nvidia', label: 'NVIDIA', color: '#FF8A3D' },
  { id: 'openai', label: 'OpenAI', color: '#86efac' },
  { id: 'anthropic', label: 'Anthropic', color: '#FFA466' },
];

export function WelcomeScreen() {
  const { state, user, newConversation, setActiveConversation, dispatch } = useApp();
  const { conversations } = state;

  const recentConvs = conversations.slice(0, 3);
  const userName = user?.name || (typeof window !== 'undefined' ? localStorage.getItem('chaty_user_name') : null);

  return (
    <div
      className="flex flex-col items-center justify-center h-full overflow-auto w-full"
      style={{ padding: 'var(--chat-padding)', background: 'var(--bg)' }}
    >
      <div style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          
          {/* Phosphor Amber Glowing Orb */}
          <div style={{ position: 'relative', width: 68, height: 68 }}>
            <div
              className="animate-breathe"
              style={{
                position: 'absolute',
                inset: -10,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 138, 61, 0.35) 0%, transparent 70%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #FF8A3D 0%, #B8591B 65%, #17171A 100%)',
                border: '1px solid rgba(255, 138, 61, 0.5)',
                boxShadow: '0 0 24px rgba(255, 138, 61, 0.35), inset 0 0 12px rgba(255, 138, 61, 0.4)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 12,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.65)',
                filter: 'blur(3px)',
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF8A3D]/10 border border-[#FF8A3D]/30 text-[#FF8A3D] text-[11px] font-mono font-medium">
                <Sparkles size={11} />
                PHOSPHOR CORE
              </span>
            </div>
            
            <h1
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(24px, 5vw, 32px)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'var(--fg)',
                margin: 0,
              }}
            >
              CHAT-Y
            </h1>

            <p style={{ color: 'var(--fg-3)', margin: '6px 0 0', fontSize: 14 }}>
              {userName ? (
                <>Welcome back, <span className="text-[#FF8A3D] font-medium">{userName}</span></>
              ) : (
                'Your Minimal AI Workspace'
              )}
            </p>
          </div>

          {/* Start New Chat Button */}
          <button
            onClick={() => newConversation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 26px',
              background: 'var(--accent)',
              color: '#0A0A0B',
              border: 'none',
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 20px rgba(255, 138, 61, 0.35)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-3)';
              e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(255, 138, 61, 0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 138, 61, 0.35)';
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
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
                borderRadius: 12,
                background: 'var(--surface)',
                textAlign: 'left',
                transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                color: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-bd)';
                e.currentTarget.style.background = 'var(--elevated)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35), 0 0 12px rgba(255,138,61,0.08)';
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
              RECENT CONVERSATIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentConvs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
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
          <span style={{ color: 'var(--fg-4)' }}>ENGINES</span>
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
