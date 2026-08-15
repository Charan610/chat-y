'use client';

import React, { useState, useEffect } from 'react';
import { User, Key, ArrowRight, Sparkles, Copy, Check, ShieldCheck } from 'lucide-react';

interface UserOnboardingModalProps {
  onComplete: (name: string, userId: string) => void;
}

export function generateUserId(name?: string): string {
  const cleanName = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'user';
  const rand = Math.random().toString(36).substring(2, 8);
  return `${cleanName}_${rand}`;
}

export function UserOnboardingModal({ onComplete }: UserOnboardingModalProps) {
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Generate initial user ID
    setUserId(generateUserId('user'));
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (error) setError('');
    if (val.trim()) {
      setUserId(generateUserId(val.trim()));
    }
  };

  const handleCopyId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name to proceed');
      return;
    }
    const finalUserId = userId || generateUserId(trimmedName);
    
    // Save to local storage
    try {
      localStorage.setItem('chaty_user_name', trimmedName);
      localStorage.setItem('chaty_user_id', finalUserId);
      const sessionObj = {
        id: finalUserId,
        email: `${trimmedName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
        name: trimmedName,
      };
      localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
    } catch {}

    onComplete(trimmedName, finalUserId);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0A0A0B]/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-[420px] bg-[#111113] border border-[#2E2E35] hover:border-[#FF8A3D]/40 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(255,138,61,0.06)] overflow-hidden flex flex-col p-6 sm:p-7 gap-5 relative transition-all duration-300">
        
        {/* Ambient Phosphor Amber Radial Glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#FF8A3D]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#FF8A3D]/08 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col gap-1.5 text-center items-center relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-[#FF8A3D]/10 border border-[#FF8A3D]/30 flex items-center justify-center mb-1.5 shadow-[0_0_20px_rgba(255,138,61,0.15)]">
            <Sparkles className="w-6 h-6 text-[#FF8A3D]" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Welcome to Chat-Y</h2>
          <p className="text-xs text-[#A1A1AA] max-w-[300px] leading-relaxed">
            Enter your name to initialize your personalized workspace with persistent memory and chat history.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
          {/* User Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-[#FF8A3D]" />
              Your Name / Alias
            </label>
            <input
              type="text"
              placeholder="e.g. Charan"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#17171A] border border-[#2E2E35] text-[#F4F4F5] placeholder-[#52525B] focus:border-[#FF8A3D] focus:bg-[#111113] focus:shadow-[0_0_0_3px_rgba(255,138,61,0.12)] outline-none transition-all"
              autoFocus
            />
            {error && <span className="text-[11px] font-mono text-[#b87470]">{error}</span>}
          </div>

          {/* User ID Display */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#FF8A3D]" />
                Workspace ID
              </span>
              <span className="text-[10px] text-[#52525B]">Persistent Profile</span>
            </label>

            <div className="flex items-center gap-2 px-3 py-2 bg-[#0A0A0B] border border-[#242429] rounded-xl">
              <span className="font-mono text-xs text-[#FF8A3D] font-medium flex-1 tracking-wide truncate">
                {userId || 'generating...'}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1.5 rounded-lg hover:bg-[#1F1F23] text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer"
                title="Copy User ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#6b9a78]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#FF8A3D] hover:bg-[#FFA466] text-[#0A0A0B] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-1 shadow-[0_4px_20px_rgba(255,138,61,0.3)] hover:shadow-[0_6px_28px_rgba(255,138,61,0.45)] transition-all cursor-pointer group active:scale-[0.98]"
          >
            <span>Enter Workspace</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 text-center font-mono text-[10px] text-[#52525B] pt-1 border-t border-[#242429]">
          <ShieldCheck className="w-3 h-3 text-[#6b9a78]" />
          <span>Local Profile • Chats Remembered &amp; Secured</span>
        </div>
      </div>
    </div>
  );
}
