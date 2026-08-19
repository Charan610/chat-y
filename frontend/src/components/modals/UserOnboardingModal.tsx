'use client';

import React, { useState } from 'react';
import { User, Key, ArrowRight, Sparkles, Copy, Check, ShieldCheck, LogIn, UserPlus, RefreshCw } from 'lucide-react';

interface UserOnboardingModalProps {
  onComplete: (name: string, userId: string) => void;
}

export function generateRandomUserId(name?: string): string {
  const cleanName = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'user';
  const rand = Math.random().toString(36).substring(2, 8);
  return `${cleanName}_${rand}`;
}

export function UserOnboardingModal({ onComplete }: UserOnboardingModalProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('new');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState(() => generateRandomUserId('user'));
  const [existingId, setExistingId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleRegenerateId = () => {
    const fresh = generateRandomUserId(name || 'user');
    setUserId(fresh);
  };

  const handleCopyId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim() || 'User';
    const trimmedId = userId.trim();

    if (trimmedId.length < 6) {
      setError('Workspace ID must be at least 6 characters long');
      return;
    }

    try {
      localStorage.setItem('chaty_user_name', trimmedName);
      localStorage.setItem('chaty_user_id', trimmedId);
      const sessionObj = {
        id: trimmedId,
        email: `${trimmedName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
        name: trimmedName,
      };
      localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
    } catch {}

    onComplete(trimmedName, trimmedId);
  };

  const handleExistingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = existingId.trim();

    if (!cleanId) {
      setError('Please enter your Workspace / User ID');
      return;
    }

    if (cleanId.length < 6) {
      setError('User ID must be at least 6 characters');
      return;
    }

    // Infer or recover a display name
    let recoveredName = cleanId.split('_')[0] || 'User';
    recoveredName = recoveredName.charAt(0).toUpperCase() + recoveredName.slice(1);

    try {
      localStorage.setItem('chaty_user_name', recoveredName);
      localStorage.setItem('chaty_user_id', cleanId);
      const sessionObj = {
        id: cleanId,
        email: `${recoveredName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
        name: recoveredName,
      };
      localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
    } catch {}

    onComplete(recoveredName, cleanId);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0A0A0B]/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-[430px] bg-[#111113] border border-[#2E2E35] hover:border-[#FF8A3D]/40 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(255,138,61,0.06)] overflow-hidden flex flex-col p-6 sm:p-7 gap-5 relative transition-all duration-300">
        
        {/* Ambient Phosphor Amber Radial Glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#FF8A3D]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#FF8A3D]/08 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col gap-1.5 text-center items-center relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-[#FF8A3D]/10 border border-[#FF8A3D]/30 flex items-center justify-center mb-1 shadow-[0_0_20px_rgba(255,138,61,0.15)]">
            <Sparkles className="w-6 h-6 text-[#FF8A3D]" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Welcome to Chat-Y</h2>
          <p className="text-xs text-[#A1A1AA] max-w-[320px] leading-relaxed">
            Enter your Workspace ID (6+ characters) to open previous chats, or create a new workspace profile.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#17171A] rounded-xl border border-[#2E2E35] relative z-10 text-xs">
          <button
            type="button"
            onClick={() => { setTab('new'); setError(''); }}
            className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'new'
                ? 'bg-[#FF8A3D] text-[#0A0A0B] font-bold shadow-[0_2px_10px_rgba(255,138,61,0.25)]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F23]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Profile</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('existing'); setError(''); }}
            className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'existing'
                ? 'bg-[#FF8A3D] text-[#0A0A0B] font-bold shadow-[0_2px_10px_rgba(255,138,61,0.25)]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F23]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Open Existing ID</span>
          </button>
        </div>

        {/* Tab 1: New Profile Form */}
        {tab === 'new' && (
          <form onSubmit={handleNewSubmit} className="flex flex-col gap-4 relative z-10">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-[#FF8A3D]" />
                Your Name / Alias
              </label>
              <input
                type="text"
                placeholder="e.g. Charan"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#17171A] border border-[#2E2E35] text-[#F4F4F5] placeholder-[#52525B] focus:border-[#FF8A3D] focus:bg-[#111113] focus:shadow-[0_0_0_3px_rgba(255,138,61,0.12)] outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#FF8A3D]" />
                  Unique Workspace ID (min 6 chars)
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateId}
                  className="text-[10px] text-[#FF8A3D] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Random</span>
                </button>
              </label>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0B] border border-[#242429] rounded-xl focus-within:border-[#FF8A3D]">
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. charan_user_01"
                  className="w-full bg-transparent font-mono text-xs text-[#FF8A3D] font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1.5 rounded-lg hover:bg-[#1F1F23] text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer shrink-0"
                  title="Copy User ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#6b9a78]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && <span className="text-[11px] font-mono text-[#b87470]">{error}</span>}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF8A3D] hover:bg-[#FFA466] text-[#0A0A0B] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-1 shadow-[0_4px_20px_rgba(255,138,61,0.3)] hover:shadow-[0_6px_28px_rgba(255,138,61,0.45)] transition-all cursor-pointer group active:scale-[0.98]"
            >
              <span>Create &amp; Enter Workspace</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        )}

        {/* Tab 2: Open Existing ID Form */}
        {tab === 'existing' && (
          <form onSubmit={handleExistingSubmit} className="flex flex-col gap-4 relative z-10">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                <Key className="w-3.5 h-3.5 text-[#FF8A3D]" />
                Enter Your Previous Workspace ID (6+ chars)
              </label>
              <input
                type="text"
                placeholder="e.g. charan_user_01 or your custom passcode"
                value={existingId}
                onChange={(e) => {
                  setExistingId(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-[#17171A] border border-[#2E2E35] text-[#FF8A3D] placeholder-[#52525B] focus:border-[#FF8A3D] focus:bg-[#111113] focus:shadow-[0_0_0_3px_rgba(255,138,61,0.12)] outline-none transition-all"
                autoFocus
              />
              <p className="text-[11px] text-[#71717A] leading-relaxed mt-0.5">
                Typing your previous ID will automatically restore and open all your previous chats and persistent history.
              </p>
            </div>

            {error && <span className="text-[11px] font-mono text-[#b87470]">{error}</span>}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF8A3D] hover:bg-[#FFA466] text-[#0A0A0B] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-1 shadow-[0_4px_20px_rgba(255,138,61,0.3)] hover:shadow-[0_6px_28px_rgba(255,138,61,0.45)] transition-all cursor-pointer group active:scale-[0.98]"
            >
              <span>Restore &amp; Open Chats</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-2 text-center font-mono text-[10px] text-[#52525B] pt-1 border-t border-[#242429]">
          <ShieldCheck className="w-3 h-3 text-[#6b9a78]" />
          <span>User Chats Isolated &amp; Remembered by Workspace ID</span>
        </div>
      </div>
    </div>
  );
}
