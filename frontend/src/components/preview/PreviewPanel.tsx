'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { apiClient } from '@/lib/api';
import type { UploadedFile } from '@/types';
import { X, Download, Trash2, FileText, Image, Video, AudioLines, Code, Copy, Check } from 'lucide-react';

export function PreviewPanel() {
  const { state, dispatch, showToast } = useApp();
  const file = state.activePanelFile;

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewContent(null);
      return;
    }

    const loadPreview = async () => {
      // Only load text preview for code, text, json, csv, etc.
      const textTypes = ['code', 'text', 'csv', 'config', 'json', 'markdown'];
      if (!textTypes.includes(file.file_type)) {
        setPreviewContent(null);
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.get<{ content: string }>(`/api/files/${file.id}/preview`);
        setPreviewContent(res.content);
      } catch (err) {
        showToast('Failed to load file preview', 'error');
        setPreviewContent('Error loading preview content.');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [file, showToast]);

  if (!file) return null;

  const handleClose = () => {
    dispatch({ type: 'SET_PANEL_FILE', payload: null });
  };

  const handleCopyPath = () => {
    const relativePath = `/uploads/${file.filename}`;
    navigator.clipboard.writeText(relativePath);
    setCopied(true);
    showToast('File path copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this file permanently?')) return;
    try {
      await apiClient.delete(`/api/files/${file.id}`);
      showToast('File deleted successfully', 'success');
      handleClose();
    } catch (err) {
      showToast('Failed to delete file', 'error');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-7 h-7" style={{ color: 'var(--accent)' }} />;
      case 'video': return <Video className="w-7 h-7" style={{ color: 'var(--accent)' }} />;
      case 'audio': return <AudioLines className="w-7 h-7" style={{ color: 'var(--accent)' }} />;
      case 'code': return <Code className="w-7 h-7" style={{ color: 'var(--accent)' }} />;
      default: return <FileText className="w-7 h-7" style={{ color: 'var(--fg-3)' }} />;
    }
  };

  // Mobile: bottom sheet layout
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={handleClose}
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        />
        <div
          className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up-sheet safe-area-bottom"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--line)',
            borderRadius: '16px 16px 0 0',
            maxHeight: '85dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-3)' }} />
          </div>
          {renderContent(file)}
        </div>
      </>
    );
  }

  // Desktop: side panel
  return (
    <div
      className="animate-slide-in-right"
      style={{
        width: 340,
        borderLeft: '1px solid var(--line)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        zIndex: 40,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {renderContent(file)}
    </div>
  );

  function renderContent(file: UploadedFile) {
    return (
      <>
        {/* Header */}
        <div style={{
          height: 48,
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
            File Preview
          </span>
          <button
            onClick={handleClose}
            className="touch-btn"
            style={{
              color: 'var(--fg-4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              transition: 'all 150ms ease',
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
            <X size={16} />
          </button>
        </div>

        {/* Info Card */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ padding: 10, background: 'var(--elevated)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
            {getFileIcon(file.file_type)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.original_name}>
              {file.original_name}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, textTransform: 'uppercase' }}>
              {file.file_type} • {formatSize(file.file_size)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: 10, borderBottom: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', gap: 6, justifyContent: 'flex-end', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={handleCopyPath} className="btn" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6 }}>
            {copied ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
            Copy Path
          </button>
          <a href={`/uploads/${file.filename}`} download={file.original_name} className="btn-primary" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }}>
            <Download size={13} />
            Download
          </a>
          <button
            onClick={handleDelete}
            className="btn"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              borderRadius: 6,
              borderColor: 'rgba(184,116,112,0.25)',
              color: 'var(--bad)',
            }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>

        {/* Preview Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: 14, WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase' }}>Loading preview...</span>
            </div>
          ) : file.file_type === 'image' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--elevated)', border: '1px solid var(--line)', padding: 8, borderRadius: 8, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/uploads/${file.filename}`}
                alt={file.original_name}
                style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 6 }}
              />
            </div>
          ) : file.file_type === 'video' ? (
            <div style={{ background: 'var(--elevated)', border: '1px solid var(--line)', padding: 8, borderRadius: 8, overflow: 'hidden' }}>
              <video
                src={`/uploads/${file.filename}`}
                controls
                style={{ width: '100%', borderRadius: 6 }}
              />
            </div>
          ) : file.file_type === 'audio' ? (
            <div style={{ background: 'var(--elevated)', border: '1px solid var(--line)', padding: 14, borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
              <audio
                src={`/uploads/${file.filename}`}
                controls
                style={{ width: '100%' }}
              />
            </div>
          ) : previewContent ? (
            <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', background: 'var(--elevated)', padding: 12, border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto', maxHeight: 450, whiteSpace: 'pre-wrap', WebkitOverflowScrolling: 'touch' }}>
              <code>{previewContent}</code>
            </pre>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: 'var(--fg-4)', border: '1px dashed var(--line)', borderRadius: 8 }}>
              <FileText size={24} style={{ marginBottom: 8, color: 'var(--fg-3)' }} />
              <p style={{ fontSize: 12, margin: 0 }}>No interactive preview available</p>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', marginTop: 4, textTransform: 'uppercase' }}>Download to view file contents</p>
            </div>
          )}
        </div>
      </>
    );
  }
}
