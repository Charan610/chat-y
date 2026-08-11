'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import {
  Copy,
  RefreshCw,
  Pin,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  Zap,
  Brain,
} from 'lucide-react';
import type { Message } from '@/types';
import { useApp } from '@/context/AppContext';

function getProvider(model?: string) {
  return model?.split('/')[0]?.toLowerCase() || '';
}

function getModelName(model?: string) {
  if (!model) return 'AI';
  const parts = model.split('/');
  return parts[parts.length - 1] || model;
}

function getModelAvatar(model?: string) {
  const name = getModelName(model);
  return name.charAt(0).toUpperCase();
}

function getSpeedBadge(provider: string) {
  if (provider === 'groq') return { label: '⚡ FAST', color: '#b8956a' };
  if (provider === 'nvidia') return { label: '🧠 REASONING', color: '#7a8eaa' };
  return null;
}

function formatCost(cost: number) {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return '<$0.0001';
  return `$${cost.toFixed(4)}`;
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace('language-', '') || '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--line-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 12px',
          background: 'var(--elevated)',
          borderBottom: '1px solid var(--line-2)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.06em' }}>
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: copied ? 'var(--ok)' : 'var(--fg-4)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
            transition: 'color 120ms',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          borderRadius: 0,
          border: 'none',
        }}
      >
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function ReasoningSection({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: 6,
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          background: 'var(--elevated)',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--fg-3)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          transition: 'color 120ms',
        }}
      >
        <Brain size={12} />
        <span>THINKING</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--bg)',
            borderTop: '1px solid var(--line)',
            fontSize: 13,
            color: 'var(--fg-3)',
            fontStyle: 'italic',
            lineHeight: 1.6,
            borderLeft: '3px solid var(--line-3)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const { showToast, dispatch } = useApp();
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const provider = getProvider(message.model);
  const speedBadge = getSpeedBadge(provider);
  const modelName = getModelName(message.model);
  const avatarLetter = getModelAvatar(message.model);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    showToast('Copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  }, [message.content, showToast]);

  const citations = message.metadata?.citations;
  const attachedFiles = message.metadata?.files;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '12px 24px',
        display: 'flex',
        gap: 12,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        transition: 'background 120ms',
        background: hover ? 'rgba(255,255,255,0.015)' : 'transparent',
        position: 'relative',
      }}
    >
      {/* Avatar */}
      {isUser ? (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--line-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--fg-2)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          U
        </div>
      ) : (
        <div
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
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {avatarLetter}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: isUser ? '80%' : '100%' }}>
        {/* Header */}
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                fontWeight: 500,
              }}
            >
              {modelName}
            </span>
            {speedBadge && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: speedBadge.color,
                  background: `${speedBadge.color}18`,
                  border: `1px solid ${speedBadge.color}40`,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {speedBadge.label}
              </span>
            )}
          </div>
        )}

        {/* User message bubble */}
        {isUser ? (
          <div>
            {attachedFiles && attachedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, justifyContent: 'flex-end' }}>
                {attachedFiles.map(f => (
                  <span key={f.id} className="tag">
                    📎 {f.original_name}
                  </span>
                ))}
              </div>
            )}
            <div
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--line-2)',
                borderRadius: '10px 10px 2px 10px',
                padding: '10px 14px',
                fontSize: 14,
                color: 'var(--fg)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </div>
          </div>
        ) : (
          <div>
            {/* Reasoning */}
            {message.reasoning_content && (
              <ReasoningSection content={message.reasoning_content} />
            )}

            {/* Main content */}
            <div className="prose-dark" style={{ fontSize: 14 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match !== null;
                    return isBlock ? (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span
                  className="streaming-cursor"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 1 }}
                >
                  █
                </span>
              )}
            </div>

            {/* Citations */}
            {citations && citations.length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--elevated)', border: '1px solid var(--line-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', marginBottom: 8, letterSpacing: '0.06em' }}>
                  SOURCES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {citations.map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        color: 'var(--accent)',
                        textDecoration: 'none',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginTop: 2, flexShrink: 0 }}>
                        [{i + 1}]
                      </span>
                      <span>{c.title || c.url}</span>
                      <ExternalLink size={11} style={{ flexShrink: 0, marginTop: 3, color: 'var(--fg-4)' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata strip */}
            {!isStreaming && (message.total_tokens > 0 || message.latency_ms > 0) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 10,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-4)',
                  flexWrap: 'wrap',
                }}
              >
                {message.model && (
                  <span title="Model">{message.model}</span>
                )}
                {message.total_tokens > 0 && (
                  <span title="Tokens">
                    ↑{message.prompt_tokens} ↓{message.completion_tokens} ={message.total_tokens}
                  </span>
                )}
                {message.latency_ms > 0 && (
                  <span title="Latency">{formatLatency(message.latency_ms)}</span>
                )}
                {message.estimated_cost > 0 && (
                  <span title="Estimated cost">{formatCost(message.estimated_cost)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons (on hover) */}
        {hover && !isStreaming && (
          <div
            className="animate-fade-in"
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 8,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            {[
              { icon: copied ? Check : Copy, label: 'Copy', action: handleCopy },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 7px',
                  background: 'none',
                  border: '1px solid var(--line-2)',
                  borderRadius: 4,
                  color: 'var(--fg-4)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.borderColor = 'var(--line-3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--fg-4)';
                  e.currentTarget.style.borderColor = 'var(--line-2)';
                }}
              >
                <btn.icon size={11} />
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
