'use client';

import React, { useState, useEffect } from 'react';
import { User, Key, ArrowRight, Sparkles, Copy, Check } from 'lucide-react';

interface UserOnboardingModalProps {
  onComplete: (name: string, userId: string) => void;
}

export function generateUserId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function UserOnboardingModal({ onComplete }: UserOnboardingModalProps) {
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Generate 10-char random ID if not existing
    setUserId(generateUserId());
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    localStorage.setItem('chaty_user_name', name.trim());
    localStorage.setItem('chaty_user_id', userId);
    onComplete(name.trim(), userId);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_200ms_ease]">
      <div className="w-full max-w-[420px] bg-surface border border-accent/30 rounded-xl shadow-2xl overflow-hidden flex flex-col p-6 gap-5 relative">
        
        {/* Decorative Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#9D7BFF]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col gap-1 text-center items-center">
          <div className="w-12 h-12 rounded-xl bg-accent-bg border border-accent-bd flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-lg font-bold text-fg tracking-tight">Welcome to Chat-Y</h2>
          <p className="text-xs text-fg-3 max-w-[320px]">
            Set up your workspace identity to get started with hybrid local &amp; cloud AI models.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* User Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[1px] text-fg-3 flex items-center gap-1.5">
              <User className="w-3 h-3 text-accent" />
              Your Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex or Charan"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="input w-full py-2 px-3 text-xs bg-bg border-line focus:border-accent"
              autoFocus
            />
            {error && <span className="text-[10px] font-mono text-bad">{error}</span>}
          </div>

          {/* User ID Display */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[1px] text-fg-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3 h-3 text-accent" />
                Assigned Unique User ID
              </span>
              <span className="text-[9px] text-fg-4">Auto-generated</span>
            </label>

            <div className="flex items-center gap-2 p-2 bg-bg border border-line rounded-md">
              <span className="font-mono text-xs text-accent font-semibold flex-1 tracking-wider px-1">
                {userId}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1.5 rounded hover:bg-hover text-fg-4 hover:text-fg transition-colors cursor-pointer"
                title="Copy User ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#6b9a78]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 mt-2 group cursor-pointer"
          >
            Enter Workspace
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="text-center font-mono text-[9px] text-fg-4">
          Chat-Y Workspace • Hybrid AI Platform
        </div>
      </div>
    </div>
  );
}
