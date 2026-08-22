'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Globe, Smartphone, X, ArrowRight, Sparkles } from 'lucide-react';

interface WorkspaceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeb: () => void;
}

export function WorkspaceEntryModal({
  isOpen,
  onClose,
  onSelectWeb,
}: WorkspaceEntryModalProps) {
  const [isAndroid, setIsAndroid] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const webBtnRef = useRef<HTMLButtonElement>(null);

  const installUrl =
    process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || '/download';

  // Detect Android user agent for smart default highlight
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsAndroid(/Android/i.test(navigator.userAgent));
    }
  }, []);

  // Keyboard accessibility: ESC to close & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus first option
    const timer = setTimeout(() => {
      webBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChooseWeb = () => {
    try {
      localStorage.setItem('chaty_entry_pref', 'web');
    } catch {}
    onSelectWeb();
  };

  const handleChooseAndroid = () => {
    try {
      localStorage.setItem('chaty_entry_pref', 'android');
    } catch {}
    window.open(installUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-entry-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border p-6 sm:p-7 relative flex flex-col gap-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        style={{
          background: '#0A0A0B',
          borderColor: '#242429',
          color: '#F4F4F5',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-16 -left-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: 'var(--accent, #4FB8A6)' }}
        />

        {/* Top Header & Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border"
                style={{
                  background: 'rgba(79, 184, 166, 0.1)',
                  borderColor: 'rgba(79, 184, 166, 0.3)',
                  color: 'var(--accent, #4FB8A6)',
                }}
              >
                WORKSPACE ACCESS
              </span>
            </div>
            <h2
              id="workspace-entry-title"
              className="text-lg sm:text-xl font-bold tracking-tight text-white"
            >
              Choose your Chat-Y experience
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Select how you would like to enter your workspace.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Equal-Weight Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Web Option */}
          <button
            ref={webBtnRef}
            onClick={handleChooseWeb}
            className="group flex flex-col items-start text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400"
            style={{
              background: '#131316',
              borderColor: '#282830',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent, #4FB8A6)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#282830';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border mb-3 transition-colors"
              style={{
                background: '#18181C',
                borderColor: '#2E2E38',
                color: 'var(--accent, #4FB8A6)',
              }}
            >
              <Globe size={20} />
            </div>

            <div className="font-semibold text-sm text-white flex items-center gap-1.5">
              <span>Continue in browser</span>
              <ArrowRight
                size={14}
                className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-snug">
              Jump straight into your workspace
            </p>
          </button>

          {/* Android Option */}
          <button
            onClick={handleChooseAndroid}
            className="group flex flex-col items-start text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-zinc-400"
            style={{
              background: '#131316',
              borderColor: isAndroid ? 'rgba(79, 184, 166, 0.45)' : '#282830',
              boxShadow: isAndroid
                ? '0 0 16px rgba(79, 184, 166, 0.08)'
                : 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent, #4FB8A6)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isAndroid
                ? 'rgba(79, 184, 166, 0.45)'
                : '#282830';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {isAndroid && (
              <span
                className="absolute top-3 right-3 text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border"
                style={{
                  background: 'rgba(79, 184, 166, 0.12)',
                  borderColor: 'rgba(79, 184, 166, 0.35)',
                  color: 'var(--accent, #4FB8A6)',
                }}
              >
                RECOMMENDED
              </span>
            )}

            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border mb-3 transition-colors"
              style={{
                background: '#18181C',
                borderColor: isAndroid ? 'rgba(79, 184, 166, 0.4)' : '#2E2E38',
                color: 'var(--accent, #4FB8A6)',
              }}
            >
              <Smartphone size={20} />
            </div>

            <div className="font-semibold text-sm text-white flex items-center gap-1.5">
              <span>Get the Android app</span>
              <ArrowRight
                size={14}
                className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-snug">
              Native app, faster on mobile
            </p>
          </button>
        </div>

        {/* Persistence Notice */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1 border-t border-[#1C1C22]">
          <span>Choice is remembered for next visit</span>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('chaty_entry_pref');
              } catch {}
              onSelectWeb();
            }}
            className="text-zinc-400 hover:text-zinc-200 underline transition-colors"
          >
            Enter once
          </button>
        </div>
      </div>
    </div>
  );
}
