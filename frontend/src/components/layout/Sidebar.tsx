'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Pin,
  Star,
  Trash2,
  MoreHorizontal,
  Settings,
  Brain,
  BarChart2,
  ChevronRight,
  MessageSquare,
  X,
  Edit2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { formatDistanceToNow } from 'date-fns';

function getModelShort(model: string) {
  const parts = model.split('/');
  return parts[parts.length - 1]?.slice(0, 12) || model;
}

function ConvContextMenu({
  id,
  isPinned,
  onClose,
  x,
  y,
}: {
  id: string;
  isPinned: boolean;
  onClose: () => void;
  x: number;
  y: number;
}) {
  const { deleteConv, togglePin, renameConv } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  if (renaming) {
    return (
      <div
        ref={ref}
        className="animate-fade-in-scale"
        style={{
          position: 'fixed',
          top: y,
          left: x,
          zIndex: 9999,
          background: 'var(--elevated)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          padding: 8,
          minWidth: 200,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <input
          autoFocus
          className="input text-xs"
          placeholder="New name…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { renameConv(id, newTitle); onClose(); }
            if (e.key === 'Escape') onClose();
          }}
        />
      </div>
    );
  }

  const items = [
    { label: 'Rename', icon: Edit2, action: () => { setRenaming(true); } },
    { label: isPinned ? 'Unpin' : 'Pin', icon: Pin, action: () => { togglePin(id); onClose(); } },
    { label: 'Delete', icon: Trash2, action: () => { deleteConv(id); onClose(); }, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="animate-fade-in-scale"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'var(--elevated)',
        border: '1px solid var(--line-2)',
        borderRadius: 10,
        padding: 4,
        minWidth: 160,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={item.action}
          className="touch-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            width: '100%',
            background: 'none',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: item.danger ? 'var(--bad)' : 'var(--fg-2)',
            fontSize: 13,
            textAlign: 'left',
            transition: 'background 150ms ease, color 150ms ease',
            justifyContent: 'flex-start',
            minHeight: 40,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <item.icon size={14} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { state, dispatch, setActiveConversation, newConversation } = useApp();
  const { conversations, activeConversationId, sidebarOpen } = state;
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile on initial load
      if (mobile && sidebarOpen) {
        dispatch({ type: 'SET_SIDEBAR', payload: false });
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = conversations
    .filter(c => !c.is_archived)
    .filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30);

  const pinned = filtered.filter(c => c.is_pinned);
  const recent = filtered.filter(c => !c.is_pinned).slice(0, 15);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const handleSelectConv = (id: string) => {
    setActiveConversation(id);
    if (isMobile) {
      dispatch({ type: 'SET_SIDEBAR', payload: false });
    }
  };

  const handleNewChat = (prompt?: string) => {
    newConversation(prompt);
    if (isMobile) {
      dispatch({ type: 'SET_SIDEBAR', payload: false });
    }
  };

  // Touch swipe to close on mobile
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60 && isMobile) {
      dispatch({ type: 'SET_SIDEBAR', payload: false });
    }
  }, [isMobile, dispatch]);

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{
          width: isMobile ? (sidebarOpen ? 280 : 0) : (sidebarOpen ? 260 : 56),
          x: isMobile && !sidebarOpen ? -280 : 0,
        }}
        transition={{
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          flexShrink: 0,
          position: isMobile ? 'fixed' : 'relative',
          left: 0,
          top: 0,
          zIndex: isMobile ? 50 : 10,
          boxShadow: isMobile && sidebarOpen ? '4px 0 32px rgba(0,0,0,0.4)' : 'none',
          willChange: 'width, transform',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarOpen ? '14px 14px 12px' : '14px 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          {/* Brand Logo with breathing glow */}
          <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
            <div
              className="animate-breathe"
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
              }}
            />
            <svg
              width="30"
              height="30"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ position: 'relative', zIndex: 1 }}
            >
              <circle cx="50" cy="50" r="46" fill="#17171A" stroke="#2E2E35" strokeWidth="2"/>
              <circle cx="50" cy="50" r="44" fill="#111113"/>
              <circle cx="50" cy="50" r="42" fill="#17171A"/>
              <rect x="27" y="27" width="46" height="46" rx="10" fill="#FF8A3D"/>
              <circle cx="50" cy="50" r="18" fill="#0A0A0B"/>
              <polygon points="50,40 40.5,57.5 59.5,57.5" fill="#FF8A3D"/>
            </svg>
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: 'var(--fg)',
                }}
              >
                CHAT-Y
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* New Chat */}
        <div style={{ padding: sidebarOpen ? '10px 10px 6px' : '10px 6px 6px', flexShrink: 0 }}>
          <button
            onClick={() => handleNewChat()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8,
              padding: sidebarOpen ? '9px 12px' : '9px',
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-bd)',
              borderRadius: 8,
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              minHeight: 40,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 138, 61, 0.16)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 138, 61, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent-bg)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus size={15} />
            {sidebarOpen && <span>New Chat</span>}
          </button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              style={{ padding: '0 10px 8px', overflow: 'hidden', flexShrink: 0 }}
            >
              <div style={{ position: 'relative' }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--fg-4)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
                  placeholder="Search chats…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--fg-4)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {/* Pinned */}
          {pinned.length > 0 && sidebarOpen && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ padding: '8px 8px 4px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.1em', fontWeight: 600 }}>
                PINNED
              </div>
              {pinned.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConversationId}
                  collapsed={!sidebarOpen}
                  onClick={() => handleSelectConv(conv.id)}
                  onContextMenu={e => handleContextMenu(e, conv.id)}
                />
              ))}
            </div>
          )}

          {/* Recent */}
          {recent.length > 0 && (
            <div>
              {sidebarOpen && (
                <div style={{ padding: '8px 8px 4px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.1em', fontWeight: 600 }}>
                  RECENT
                </div>
              )}
              {recent.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConversationId}
                  collapsed={!sidebarOpen}
                  onClick={() => handleSelectConv(conv.id)}
                  onContextMenu={e => handleContextMenu(e, conv.id)}
                />
              ))}
            </div>
          )}

          {conversations.length === 0 && sidebarOpen && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--fg-4)', fontSize: 12 }}>
              <MessageSquare size={24} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No conversations yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-4)' }}>Start a new chat to begin</p>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ borderTop: '1px solid var(--line)', padding: sidebarOpen ? '6px 10px 8px' : '6px 6px 8px', flexShrink: 0 }}>
          {[
            { icon: Brain, label: 'Memories', tab: 'memory' },
            { icon: BarChart2, label: 'Analytics', tab: 'analytics' },
          ].map(item => (
            <button
              key={item.tab}
              onClick={() => {
                dispatch({ type: 'SET_SETTINGS_TAB', payload: item.tab });
                dispatch({ type: 'SET_SETTINGS_OPEN', payload: true });
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: sidebarOpen ? '8px 10px' : '8px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                color: 'var(--fg-3)',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                minHeight: 36,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--hover)';
                e.currentTarget.style.color = 'var(--fg)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--fg-3)';
              }}
            >
              <item.icon size={15} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
          <button
            onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', payload: true })}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: sidebarOpen ? '8px 10px' : '8px',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              background: 'none',
              border: 'none',
              borderRadius: 6,
              color: 'var(--fg-3)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              minHeight: 36,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--hover)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--fg-3)';
            }}
          >
            <Settings size={15} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </motion.aside>

      {/* Context Menu */}
      {contextMenu && (
        <ConvContextMenu
          id={contextMenu.id}
          isPinned={conversations.find(c => c.id === contextMenu.id)?.is_pinned || false}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function ConvItem({
  conv,
  active,
  collapsed,
  onClick,
  onContextMenu,
}: {
  conv: { id: string; title: string; model: string; updated_at: string; is_pinned: boolean };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '8px' : '8px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background 150ms ease',
        background: active ? 'var(--hover)' : hover ? 'rgba(255,255,255,0.03)' : 'none',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginBottom: 2,
        minHeight: 44,
      }}
    >
      {collapsed ? (
        <MessageSquare size={15} style={{ color: active ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }} />
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              color: active ? 'var(--fg)' : 'var(--fg-2)',
              fontWeight: active ? 500 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.4,
            }}>
              {conv.title || 'New Chat'}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--fg-4)',
              marginTop: 2,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                {getModelShort(conv.model)}
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
          {hover && (
            <button
              onClick={e => { e.stopPropagation(); onContextMenu(e); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--fg-4)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                flexShrink: 0,
                display: 'flex',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-4)')}
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
