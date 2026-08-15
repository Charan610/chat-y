'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  ChevronDown,
  Copy,
  Check,
  Edit2,
  UserPlus,
  RefreshCw,
  LogOut,
  Sparkles,
  MessageSquare,
  Shield,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function UserProfileButton() {
  const { state, user, showToast } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [switchingUser, setSwitchingUser] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read persona info
  const storedName = typeof window !== 'undefined' ? localStorage.getItem('chaty_user_name') || '' : '';
  const storedId = typeof window !== 'undefined' ? localStorage.getItem('chaty_user_id') || '' : '';
  const activeName = user?.name || storedName || 'User';
  const activeId = user?.id || storedId || 'usr_main';

  useEffect(() => {
    setNameInput(activeName);
  }, [activeName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setEditingName(false);
        setSwitchingUser(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(activeId);
    setCopiedId(true);
    showToast('Workspace ID copied to clipboard', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const newName = nameInput.trim();
    try {
      localStorage.setItem('chaty_user_name', newName);
      const sessionObj = {
        id: activeId,
        email: `${newName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
        name: newName,
      };
      localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
    } catch {}
    setEditingName(false);
    showToast(`Profile name updated to ${newName}`, 'success');
    window.location.reload();
  };

  const handleSwitchUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const newName = nameInput.trim();
    const cleanSlug = newName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const newId = `${cleanSlug}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      localStorage.setItem('chaty_user_name', newName);
      localStorage.setItem('chaty_user_id', newId);
      const sessionObj = {
        id: newId,
        email: `${newName.toLowerCase().replace(/\s+/g, '')}@workspace.local`,
        name: newName,
      };
      localStorage.setItem('chaty_user_session', JSON.stringify(sessionObj));
    } catch {}

    setSwitchingUser(false);
    setDropdownOpen(false);
    showToast(`Switched workspace identity to ${newName}`, 'success');
    window.location.reload();
  };

  const handleResetSession = () => {
    if (confirm('Create a fresh workspace profile? Your current identity and chats can be reloaded by entering the same name.')) {
      try {
        localStorage.removeItem('chaty_user_id');
        localStorage.removeItem('chaty_user_name');
        localStorage.removeItem('chaty_user_session');
      } catch {}
      window.location.reload();
    }
  };

  const initial = activeName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile trigger pill */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#17171A] hover:bg-[#1F1F23] border border-[#2E2E35] hover:border-[#FF8A3D]/40 transition-all duration-200 cursor-pointer text-xs group"
        title={`User: ${activeName}`}
      >
        <div className="w-5 h-5 rounded-full bg-[#FF8A3D]/15 border border-[#FF8A3D]/30 text-[#FF8A3D] flex items-center justify-center font-bold text-[10px] shadow-[0_0_8px_rgba(255,138,61,0.2)]">
          {initial}
        </div>
        <span className="font-medium text-[#F4F4F5] max-w-[100px] truncate hidden sm:inline group-hover:text-[#FF8A3D] transition-colors">
          {activeName}
        </span>
        <ChevronDown size={11} className="text-[#71717A] group-hover:text-[#F4F4F5] transition-transform duration-200 group-hover:translate-y-[1px]" />
      </button>

      {/* Profile Popover Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#111113] border border-[#2E2E35] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(255,138,61,0.08)] py-2.5 z-50 text-xs animate-fade-in divide-y divide-[#242429]">
          
          {/* Header Card */}
          <div className="px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF8A3D]/15 border border-[#FF8A3D]/30 text-[#FF8A3D] flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(255,138,61,0.25)] shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[#F4F4F5] truncate text-sm">{activeName}</div>
                <button
                  onClick={() => { setEditingName(!editingName); setSwitchingUser(false); }}
                  className="p-1 rounded text-[#71717A] hover:text-[#FF8A3D] hover:bg-[#1F1F23] transition-colors"
                  title="Rename Persona"
                >
                  <Edit2 size={12} />
                </button>
              </div>
              <div className="text-[10px] font-mono text-[#71717A] flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8A3D]" />
                <span>Active Persona</span>
              </div>
            </div>
          </div>

          {/* Quick Name Inline Editor */}
          {editingName && (
            <form onSubmit={handleSaveName} className="p-3 bg-[#17171A]/70 flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-[#A1A1AA]">Edit Name</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0A0A0B] border border-[#2E2E35] text-xs text-[#F4F4F5] focus:border-[#FF8A3D] outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF8A3D] hover:bg-[#FFA466] text-[#0A0A0B] font-bold text-xs cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Switch / New Persona Form */}
          {switchingUser && (
            <form onSubmit={handleSwitchUser} className="p-3 bg-[#17171A]/70 flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-[#A1A1AA]">Enter New User Name</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0A0A0B] border border-[#2E2E35] text-xs text-[#F4F4F5] focus:border-[#FF8A3D] outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF8A3D] hover:bg-[#FFA466] text-[#0A0A0B] font-bold text-xs cursor-pointer"
                >
                  Switch
                </button>
              </div>
            </form>
          )}

          {/* User ID Section */}
          <div className="p-3 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] flex items-center justify-between">
              <span>Workspace ID</span>
              <span className="text-[9px] text-[#52525B]">Persistent</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-[#0A0A0B] border border-[#242429] rounded-xl">
              <span className="font-mono text-xs text-[#FF8A3D] font-medium flex-1 truncate">
                {activeId}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 rounded hover:bg-[#1F1F23] text-[#71717A] hover:text-[#F4F4F5] transition-colors"
                title="Copy ID"
              >
                {copiedId ? <Check size={12} className="text-[#6b9a78]" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] text-[#A1A1AA]">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-[#FF8A3D]" />
                Saved Chats
              </span>
              <span className="font-mono font-medium text-[#F4F4F5]">{state.conversations.length}</span>
            </div>

            <button
              onClick={() => { setSwitchingUser(true); setEditingName(false); setNameInput(''); }}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#1F1F23] flex items-center gap-2.5 text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors cursor-pointer"
            >
              <UserPlus size={13} className="text-[#FF8A3D]" />
              <span>Switch / New User Identity</span>
            </button>

            <button
              onClick={handleResetSession}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#b87470]/10 flex items-center gap-2.5 text-[#b87470] transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Reset Profile &amp; Re-enter</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
