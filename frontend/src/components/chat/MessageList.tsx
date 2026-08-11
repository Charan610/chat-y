'use client';

import React, { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { MessageItem } from './MessageItem';
import { format } from 'date-fns';

function DateDivider({ date }: { date: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '16px 0 8px',
        padding: '0 24px',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-4)',
          letterSpacing: '0.06em',
        }}
      >
        {date}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, opacity: 0.5 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--elevated)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--elevated)' }} />
            <div style={{ height: 12, width: '80%', borderRadius: 4, background: 'var(--elevated)' }} />
            <div style={{ height: 12, width: '45%', borderRadius: 4, background: 'var(--elevated)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList() {
  const { state } = useApp();
  const { messages, isStreaming, streamingContent, streamingMessageId, isLoadingMessages } = state;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth', block: 'end' });
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
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 8,
      }}
    >
      {grouped.map(group => (
        <div key={group.date}>
          <DateDivider date={group.date} />
          {group.msgs.map(msg => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </div>
      ))}

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

      <div ref={bottomRef} />
    </div>
  );
}
