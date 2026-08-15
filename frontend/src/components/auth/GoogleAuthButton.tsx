'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { LogOut, UploadCloud, CheckCircle2, ChevronDown, User as UserIcon, X, Mail, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function GoogleAuthButton() {
  const { data: session, status } = useSession();
  const { user: appUser, handleGoogleSignIn, handleSignOut, importLocalChatsToAccount } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('charankumarkatta61@gmail.com');
  const [customName, setCustomName] = useState('Charan Kumar');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      await importLocalChatsToAccount();
      setImported(true);
    } finally {
      setImporting(false);
    }
  };

  const activeUser = session?.user || appUser;

  const handleQuickSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    const name = customName.trim() || customEmail.split('@')[0];
    handleGoogleSignIn({
      id: `user-${btoa(customEmail.toLowerCase()).replace(/=/g, '')}`,
      email: customEmail.trim(),
      name,
    });
    setModalOpen(false);
  };

  if (status === 'loading') {
    return (
      <div className="w-6 h-6 rounded-full bg-surface border border-line animate-pulse" />
    );
  }

  if (!activeUser) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hover:bg-hover border border-line text-xs text-fg font-medium cursor-pointer transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign in</span>
        </button>

        {modalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-surface border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-fg-3 hover:text-fg hover:bg-hover transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-accent-bg text-accent flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">Sign in to Chat-Y</h3>
                  <p className="text-xs text-fg-3">Save & sync your chat history across devices</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {/* Standard Google OAuth Button */}
                <button
                  onClick={() => {
                    setModalOpen(false);
                    signIn('google');
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface hover:bg-hover border border-line text-xs text-fg font-medium cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google OAuth</span>
                </button>

                <div className="flex items-center gap-2 my-2">
                  <div className="h-[1px] bg-line flex-1" />
                  <span className="text-[10px] uppercase tracking-wider text-fg-4 font-mono">Or 1-Click Instant Sign-In</span>
                  <div className="h-[1px] bg-line flex-1" />
                </div>

                {/* Instant Bypass Sign-in Form */}
                <form onSubmit={handleQuickSignIn} className="space-y-2.5">
                  <div>
                    <label className="text-[11px] text-fg-3 block mb-1">Your Name</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Charan Kumar"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-fg-3 block mb-1">Google / Account Email</label>
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="charankumarkatta61@gmail.com"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Mail size={13} />
                    <span>Instant Sign In as {customName || 'User'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const userName = activeUser.name || activeUser.email || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full bg-surface hover:bg-hover border border-line transition-all cursor-pointer text-xs"
      >
        {activeUser.image ? (
          <img src={activeUser.image} alt={userName} className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold text-[10px]">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-medium text-fg max-w-[100px] truncate hidden sm:inline">{userName}</span>
        <ChevronDown size={12} className="text-fg-4" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg shadow-xl py-2 z-50 text-xs">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2.5">
            {activeUser.image ? (
              <img src={activeUser.image} alt={userName} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold text-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-fg truncate">{userName}</div>
              <div className="text-[10px] text-fg-4 truncate">{activeUser.email}</div>
            </div>
          </div>

          <div className="p-1">
            <button
              onClick={handleImport}
              disabled={importing || imported}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-fg-2 hover:text-fg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {imported ? (
                <>
                  <CheckCircle2 size={14} className="text-[#6b9a78]" />
                  <span>Local chats imported!</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} className="text-accent" />
                  <span>{importing ? 'Importing...' : 'Sync local chats to account'}</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setDropdownOpen(false);
                if (session) {
                  signOut();
                }
                handleSignOut();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-bad hover:bg-bad/10 transition-colors cursor-pointer mt-1"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
