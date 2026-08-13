'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { LogOut, UploadCloud, CheckCircle2, ChevronDown, User as UserIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function GoogleAuthButton() {
  const { data: session, status } = useSession();
  const { importLocalChatsToAccount } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  if (status === 'loading') {
    return (
      <div className="w-6 h-6 rounded-full bg-surface border border-line animate-pulse" />
    );
  }

  if (!session || !session.user) {
    return (
      <button
        onClick={() => signIn('google')}
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
    );
  }

  const user = session.user;
  const userName = user.name || user.email || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full bg-surface hover:bg-hover border border-line transition-all cursor-pointer text-xs"
      >
        {user.image ? (
          <img src={user.image} alt={userName} className="w-5 h-5 rounded-full object-cover" />
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
            {user.image ? (
              <img src={user.image} alt={userName} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold text-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-fg truncate">{userName}</div>
              <div className="text-[10px] text-fg-4 truncate">{user.email}</div>
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
                signOut();
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
