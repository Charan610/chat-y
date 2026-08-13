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
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseValueRef = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast('Voice input is not supported in this browser. Try Chrome or Edge.', 'warning');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // Record starting value before speech input
      baseValueRef.current = value;

      recognition.onstart = () => {
        setIsListening(true);
        showToast('Listening... Speak into microphone', 'info');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const currentSpeech = (finalTranscript + ' ' + interimTranscript).trim();
        if (currentSpeech) {
          const base = baseValueRef.current;
          const separator = base && !base.endsWith(' ') ? ' ' : '';
          setValue(base + separator + currentSpeech);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          showToast(`Voice input error: ${event.error}`, 'error');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      showToast('Failed to start voice input', 'error');
      setIsListening(false);
    }
  }, [isListening, value, showToast]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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
      className="safe-area-bottom"
      style={{
        flexShrink: 0,
        padding: '8px 12px 12px',
        background: 'transparent',
      }}
    >
      {/* Centered floating container */}
      <div
        style={{
          maxWidth: 'var(--chat-max-width)',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, paddingLeft: 4 }}>
            {pendingFiles.map(f => (
              <div
                key={f.id}
                className="animate-fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--elevated)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                  padding: '4px 8px 4px 6px',
                  fontSize: 12,
                  color: 'var(--fg-2)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>📎</span>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.original_name}
                </span>
                <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>{formatBytes(f.file_size)}</span>
                <button
                  onClick={() => onRemoveFile(f.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--fg-4)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    borderRadius: 4,
                    transition: 'color 150ms ease',
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

        {/* Floating input pill */}
        <div
          style={{
            border: `1px solid ${isFocused ? 'var(--accent-bd)' : 'var(--line-2)'}`,
            borderRadius: 'var(--input-radius)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'border-color 200ms ease, box-shadow 300ms ease',
            boxShadow: isFocused
              ? '0 0 0 3px rgba(122,142,170,0.08), 0 8px 32px rgba(0,0,0,0.3)'
              : '0 4px 20px rgba(0,0,0,0.2)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message Chat-Y…"
            rows={1}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              lineHeight: '1.6',
              padding: '14px 16px 0',
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
              padding: '6px 10px 10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                className="touch-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-4)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
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
                <Paperclip size={16} />
              </button>

              {/* Mic */}
              <button
                onClick={toggleVoiceInput}
                title={isListening ? "Stop listening" : "Voice input"}
                className="touch-btn flex"
                style={{
                  background: isListening ? 'rgba(184, 116, 112, 0.15)' : 'none',
                  border: isListening ? '1px solid var(--bad)' : 'none',
                  color: isListening ? 'var(--bad)' : 'var(--fg-4)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => {
                  if (!isListening) {
                    e.currentTarget.style.color = 'var(--fg)';
                    e.currentTarget.style.background = 'var(--hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isListening) {
                    e.currentTarget.style.color = 'var(--fg-4)';
                    e.currentTarget.style.background = 'none';
                  }
                }}
              >
                <Mic size={16} className={isListening ? "animate-pulse" : ""} />
              </button>

              {/* Web Search */}
              <button
                onClick={() => dispatch({ type: 'TOGGLE_WEB_SEARCH' })}
                title="Toggle web search"
                className="touch-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: webSearchEnabled ? 'var(--accent-bg)' : 'none',
                  border: webSearchEnabled ? '1px solid var(--accent-bd)' : '1px solid transparent',
                  color: webSearchEnabled ? 'var(--accent)' : 'var(--fg-4)',
                  cursor: 'pointer',
                  padding: '5px 7px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  transition: 'all 200ms ease',
                }}
              >
                <Globe size={14} />
                {webSearchEnabled && <span className="hidden sm:inline">WEB</span>}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Model pill */}
              <span
                className="hidden sm:inline-flex"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fg-4)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 130,
                  alignItems: 'center',
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
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--bad)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '0.85';
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Square size={12} fill="#fff" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!value.trim()}
                  title="Send (Enter)"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: value.trim() ? 'var(--accent)' : 'var(--line-2)',
                    border: 'none',
                    color: value.trim() ? '#fff' : 'var(--fg-4)',
                    cursor: value.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 200ms ease',
                    transform: 'scale(1)',
                  }}
                  onMouseEnter={e => {
                    if (value.trim()) {
                      e.currentTarget.style.background = 'var(--accent-2)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (value.trim()) {
                      e.currentTarget.style.background = 'var(--accent)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                  onMouseDown={e => {
                    if (value.trim()) {
                      e.currentTarget.style.transform = 'scale(0.92)';
                    }
                  }}
                  onMouseUp={e => {
                    if (value.trim()) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                >
                  <ArrowUp size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hint — hidden on mobile */}
        <p
          className="hidden sm:block"
          style={{
            margin: '6px 0 0',
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--fg-4)',
            fontFamily: 'var(--font-mono)',
            opacity: 0.7,
          }}
        >
          Enter to send · Shift+Enter for new line · Paste images directly
        </p>
      </div>
    </div>
  );
}
