'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Paperclip, Mic, Globe, Send, Square, X, ArrowUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { uploadFile } from '@/lib/api';
import type { UploadedFile } from '@/types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ChatInput({
  pendingFiles,
  onRemoveFile,
  onAddFile,
  onSend,
}: {
  pendingFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  onAddFile: (file: UploadedFile) => void;
  onSend: (content: string) => void;
}) {
  const { state, dispatch, stopStreaming, showToast } = useApp();
  const { isStreaming, webSearchEnabled, activeModel } = state;
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 6 * 24 + 16;
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const uploaded = await uploadFile(file);
        onAddFile(uploaded);
        showToast(`Uploaded ${file.name}`, 'success');
      } catch {
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    }
    e.target.value = '';
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            try {
              const uploaded = await uploadFile(file);
              onAddFile(uploaded);
              showToast('Image pasted', 'success');
            } catch {
              showToast('Failed to upload pasted image', 'error');
            }
          }
        }
      }
    },
    [onAddFile, showToast]
  );

  const getModelShort = (m: string) => {
    const parts = m.split('/');
    return parts[parts.length - 1]?.slice(0, 20) || m;
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
        padding: '12px 16px 16px',
        flexShrink: 0,
      }}
    >
      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {pendingFiles.map(f => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--elevated)',
                border: '1px solid var(--line-2)',
                borderRadius: 5,
                padding: '3px 8px 3px 6px',
                fontSize: 12,
                color: 'var(--fg-2)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>📎</span>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.original_name}
              </span>
              <span style={{ color: 'var(--fg-4)' }}>{formatBytes(f.file_size)}</span>
              <button
                onClick={() => onRemoveFile(f.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-4)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  marginLeft: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-4)')}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div
        style={{
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          background: 'var(--elevated)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'border-color 120ms',
        }}
        onFocusCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--accent-bd)';
        }}
        onBlurCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--line-2)';
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message Chat-Y… (Shift+Enter for newline)"
          rows={1}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            lineHeight: '1.6',
            padding: '12px 14px 0',
            outline: 'none',
            resize: 'none',
            width: '100%',
            minHeight: 44,
            maxHeight: 152,
            overflowY: 'auto',
          }}
        />

        {/* Bottom toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--fg-4)',
                cursor: 'pointer',
                padding: 5,
                borderRadius: 5,
                display: 'flex',
                transition: 'color 120ms, background 120ms',
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
              <Paperclip size={15} />
            </button>

            {/* Mic */}
            <button
              title="Voice input"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--fg-4)',
                cursor: 'pointer',
                padding: 5,
                borderRadius: 5,
                display: 'flex',
                transition: 'color 120ms, background 120ms',
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
              <Mic size={15} />
            </button>

            {/* Web Search */}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_WEB_SEARCH' })}
              title="Toggle web search"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: webSearchEnabled ? 'var(--accent-bg)' : 'none',
                border: webSearchEnabled ? '1px solid var(--accent-bd)' : '1px solid transparent',
                color: webSearchEnabled ? 'var(--accent)' : 'var(--fg-4)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 5,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                transition: 'all 120ms',
              }}
            >
              <Globe size={13} />
              {webSearchEnabled && <span>WEB</span>}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Model pill */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fg-4)',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 140,
              }}
            >
              {getModelShort(activeModel)}
            </span>

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                title="Stop streaming"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bad)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'opacity 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Square size={12} fill="#fff" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim()}
                title="Send (Enter)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: value.trim() ? 'var(--accent)' : 'var(--line-2)',
                  border: 'none',
                  color: value.trim() ? '#fff' : 'var(--fg-4)',
                  cursor: value.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => {
                  if (value.trim()) e.currentTarget.style.background = 'var(--accent-2)';
                }}
                onMouseLeave={e => {
                  if (value.trim()) e.currentTarget.style.background = 'var(--accent)';
                }}
              >
                <ArrowUp size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        Enter to send · Shift+Enter for new line · Paste images directly
      </p>
    </div>
  );
}
