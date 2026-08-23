'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
import { Message } from '@/types';
import { useApp } from '@/context/AppContext';
import { parseFileSegments } from '@/lib/fileParser';
import { FileArtifactPanel } from './FileArtifactPanel';

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
  if (provider === 'groq') return { label: '⚡ FAST', color: '#FF8A3D' };
  if (provider === 'nvidia' || provider === 'nvidia_nim') return { label: '🧠 REASONING', color: '#FF8A3D' };
  if (provider === 'webllm') return { label: '✦ LOCAL', color: '#6b9a78' };
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
        margin: '10px 0',
        borderRadius: 8,
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
            padding: '3px 6px',
            borderRadius: 4,
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => !copied && (e.currentTarget.style.color = 'var(--fg-2)')}
          onMouseLeave={e => !copied && (e.currentTarget.style.color = 'var(--fg-4)')}
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
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
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
        margin: '10px 0',
        borderRadius: 8,
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
          padding: '8px 12px',
          background: 'var(--elevated)',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--fg-3)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          transition: 'color 150ms ease, background 150ms ease',
          minHeight: 36,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--elevated)')}
      >
        <Brain size={13} />
        <span>THINKING</span>
        <span style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          <ChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div
          className="animate-fade-in"
          style={{
            padding: '12px 14px',
            background: 'var(--bg)',
            borderTop: '1px solid var(--line)',
            fontSize: 13,
            color: 'var(--fg-3)',
            fontStyle: 'italic',
            lineHeight: 1.65,
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

  const segments = useMemo(() => {
    if (isUser) return [];
    return parseFileSegments(message.content, isStreaming);
  }, [isUser, message.content, isStreaming]);

  return (
    <div
      className="chat-column"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        paddingTop: isUser ? 16 : 12,
        paddingBottom: isUser ? 4 : 8,
        transition: 'background 200ms ease',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
        }}
      >
        {/* Avatar — smaller, cleaner */}
        {isUser ? (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--line-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
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
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-bd)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
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
        <div style={{ flex: 1, minWidth: 0, maxWidth: isUser ? '85%' : '100%' }}>
          {/* Header — assistant only */}
          {!isUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
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
                    fontSize: 9,
                    color: speedBadge.color,
                    background: `${speedBadge.color}12`,
                    border: `1px solid ${speedBadge.color}30`,
                    borderRadius: 4,
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, justifyContent: 'flex-end' }}>
                  {attachedFiles.map(f => (
                    <span key={f.id} className="tag" style={{ fontSize: 11 }}>
                      📎 {f.original_name}
                    </span>
                  ))}
                </div>
              )}
              <div
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--line-2)',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '10px 14px',
                  fontSize: 14,
                  color: 'var(--fg)',
                  lineHeight: 1.65,
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

              {/* Main content segments */}
              <div>
                {segments.map((seg, idx) => {
                  const isLastSegment = idx === segments.length - 1;
                  if (seg.type === 'file') {
                    return <FileArtifactPanel key={seg.file.id} file={seg.file} />;
                  }

                  if (!seg.content.trim() && !isStreaming) return null;

                  return (
                    <div key={idx} className="prose-dark" style={{ fontSize: 14 }}>
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
                        {seg.content}
                      </ReactMarkdown>
                      {isStreaming && isLastSegment && (
                        <span
                          className="streaming-cursor"
                          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 1 }}
                        >
                          █
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Citations */}
              {citations && citations.length > 0 && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  background: 'var(--elevated)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', marginBottom: 8, letterSpacing: '0.08em', fontWeight: 600 }}>
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
                          transition: 'opacity 150ms ease',
                          padding: '2px 0',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginTop: 2, flexShrink: 0 }}>
                          [{i + 1}]
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title || c.url}
                        </span>
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
                    gap: 10,
                    marginTop: 10,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-4)',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    whiteSpace: 'nowrap',
                    paddingBottom: 2,
                  }}
                >
                  {message.model && (
                    <span title="Model" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{message.model}</span>
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
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 6,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              opacity: hover && !isStreaming ? 1 : 0,
              transform: hover && !isStreaming ? 'translateY(0)' : 'translateY(2px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              pointerEvents: hover && !isStreaming ? 'auto' : 'none',
            }}
          >
            {[
              { icon: copied ? Check : Copy, label: 'Copy', action: handleCopy },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                className="touch-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: 'none',
                  border: '1px solid var(--line-2)',
                  borderRadius: 6,
                  color: copied ? 'var(--ok)' : 'var(--fg-4)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  minHeight: 28,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.borderColor = 'var(--line-3)';
                  e.currentTarget.style.background = 'var(--elevated)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = copied ? 'var(--ok)' : 'var(--fg-4)';
                  e.currentTarget.style.borderColor = 'var(--line-2)';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <btn.icon size={12} />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
