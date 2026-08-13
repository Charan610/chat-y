'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { LogOut, UploadCloud, CheckCircle2, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export function GoogleAuthButton() {
  const { user, handleGoogleSignIn, handleSignOut, importLocalChatsToAccount } = useApp();
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

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              try {
                const decoded = jwtDecode<GoogleJwtPayload>(credentialResponse.credential);
                handleGoogleSignIn({
                  id: decoded.sub,
                  email: decoded.email,
                  name: decoded.name,
                  picture: decoded.picture,
                });
              } catch (err) {
                console.error('Failed to decode Google token:', err);
              }
            }
          }}
          onError={() => {
            console.error('Google Sign-In Error');
          }}
          type="icon"
          shape="circle"
          theme="filled_black"
          size="small"
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full bg-surface hover:bg-hover border border-line transition-all cursor-pointer text-xs"
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold text-[10px]">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-medium text-fg max-w-[100px] truncate hidden sm:inline">{user.name}</span>
        <ChevronDown size={12} className="text-fg-4" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg shadow-xl py-2 z-50 text-xs">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2.5">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-fg truncate">{user.name}</div>
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
