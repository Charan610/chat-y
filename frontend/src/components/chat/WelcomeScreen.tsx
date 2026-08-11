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
  const { state, newConversation, dispatch } = useApp();
  const { conversations, activeModel } = state;

  const recentConvs = conversations.slice(0, 3);

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-4 sm:p-8 gap-6 sm:gap-8 overflow-auto w-full"
    >
      {/* Hero */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Orb */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
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
              top: 12,
              left: 12,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)',
              filter: 'blur(4px)',
            }}
          />
        </div>

        <div>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '0.16em',
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

        {/* Prominent Start New Chat Button */}
        <button
          onClick={() => newConversation()}
          className="btn btn-primary px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 mt-1 cursor-pointer bg-accent text-white border border-accent/40"
        >
          <Zap className="w-4 h-4 text-white animate-pulse" />
          <span>+ Start New Chat</span>
        </button>
      </div>

      {/* Quick Prompts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 8,
          width: '100%',
          maxWidth: 640,
        }}
      >
        {QUICK_PROMPTS.map(item => (
          <button
            key={item.label}
            onClick={() => newConversation(item.prompt)}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--surface)',
              textAlign: 'left',
              transition: 'all 120ms',
              color: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-bd)';
              e.currentTarget.style.background = 'var(--elevated)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <item.icon size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.4 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Recent Conversations */}
      {recentConvs.length > 0 && (
        <div style={{ width: '100%', maxWidth: 640 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>
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
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--fg-2)',
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--elevated)';
                  e.currentTarget.style.color = 'var(--fg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.color = 'var(--fg-2)';
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title || 'Untitled Chat'}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
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
          gap: 16,
          padding: '8px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
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
  );
}
