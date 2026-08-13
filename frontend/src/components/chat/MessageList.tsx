'use client';

import React, { useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MessageItem } from './MessageItem';
import { format } from 'date-fns';

function DateDivider({ date }: { date: string }) {
  return (
    <div className="chat-column">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '20px 0 12px',
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-4)',
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          {date}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="chat-column" style={{ paddingTop: 24, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          <div className="shimmer" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="shimmer" style={{ height: 12, width: '55%', borderRadius: 6 }} />
            <div className="shimmer" style={{ height: 12, width: '80%', borderRadius: 6 }} />
            <div className="shimmer" style={{ height: 12, width: '40%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList() {
  const { state } = useApp();
  const { messages, isStreaming, streamingContent, streamingMessageId, isLoadingMessages, webSearchEnabled } = state;
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: isStreaming ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [messages.length, streamingContent, isStreaming]);

  if (isLoadingMessages) return <LoadingSkeleton />;

  // Group messages by date
  const grouped: { date: string; msgs: typeof messages }[] = [];
  for (const msg of messages) {
    const d = format(new Date(msg.created_at), 'MMMM d, yyyy');
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: d, msgs: [msg] });
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        scrollPaddingBottom: 80,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Top spacer for breathing room */}
      <div style={{ flexShrink: 0, height: 8 }} />

      {grouped.map(group => (
        <div key={group.date}>
          <DateDivider date={group.date} />
          {group.msgs.map(msg => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </div>
      ))}

      {/* Web Search indicator */}
      {isStreaming && webSearchEnabled && !streamingContent && (
        <div className="chat-column my-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-bg border border-accent-bd text-accent text-xs font-mono animate-pulse">
            <Globe size={13} className="animate-spin" />
            <span>Searching the web for current information...</span>
          </div>
        </div>
      )}

      {/* Streaming message */}
      {isStreaming && (
        <MessageItem
          key="streaming"
          message={{
            id: streamingMessageId || 'streaming',
            conversation_id: '',
            role: 'assistant',
            content: streamingContent,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            latency_ms: 0,
            estimated_cost: 0,
            created_at: new Date().toISOString(),
            is_pinned: false,
          }}
          isStreaming
        />
      )}

      {/* Bottom spacer */}
      <div ref={bottomRef} style={{ flexShrink: 0, height: 16 }} />
    </div>
  );
}
