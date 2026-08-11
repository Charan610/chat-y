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
      case 'image': return <Image className="w-8 h-8 text-accent" />;
      case 'video': return <Video className="w-8 h-8 text-accent" />;
      case 'audio': return <AudioLines className="w-8 h-8 text-accent" />;
      case 'code': return <Code className="w-8 h-8 text-accent" />;
      default: return <FileText className="w-8 h-8 text-fg-3" />;
    }
  };

  return (
    <div className="w-[340px] border-l border-line bg-surface flex flex-col h-full z-40 animate-[fadeIn_220ms_ease] overflow-hidden">
      {/* Header */}
      <div className="h-12 border-bottom border-line flex items-center justify-between px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-fg-3">File Preview</span>
        </div>
        <button
          onClick={handleClose}
          className="text-fg-4 hover:text-fg transition-colors p-1 rounded hover:bg-hover cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 border-b border-line flex gap-3 items-center">
        <div className="p-2.5 bg-elevated border border-line-2 rounded-md">
          {getFileIcon(file.file_type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-fg truncate" title={file.original_name}>
            {file.original_name}
          </div>
          <div className="text-[10px] font-mono text-fg-3 uppercase mt-0.5">
            {file.file_type} • {formatSize(file.file_size)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2.5 border-b border-line bg-bg flex gap-2 justify-end">
        <button
          onClick={handleCopyPath}
          className="btn flex items-center gap-1.5 py-1 px-2.5 text-xs rounded"
          title="Copy file path"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#6b9a78]" /> : <Copy className="w-3.5 h-3.5" />}
          Copy Path
        </button>
        <a
          href={`/uploads/${file.filename}`}
          download={file.original_name}
          className="btn btn-primary flex items-center gap-1.5 py-1 px-2.5 text-xs rounded"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
        <button
          onClick={handleDelete}
          className="btn border-[#b87470]/25 text-[#b87470] hover:bg-[#b87470]/10 flex items-center gap-1.5 py-1 px-2.5 text-xs rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto bg-bg p-4 flex flex-col justify-start">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-mono uppercase text-fg-4">Loading preview...</span>
          </div>
        ) : file.file_type === 'image' ? (
          <div className="flex items-center justify-center bg-elevated border border-line p-2 rounded-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/uploads/${file.filename}`}
              alt={file.original_name}
              className="max-w-full max-h-[300px] object-contain rounded"
            />
          </div>
        ) : file.file_type === 'video' ? (
          <div className="bg-elevated border border-line p-2 rounded-md overflow-hidden">
            <video
              src={`/uploads/${file.filename}`}
              controls
              className="w-full rounded"
            />
          </div>
        ) : file.file_type === 'audio' ? (
          <div className="bg-elevated border border-line p-4 rounded-md flex justify-center">
            <audio
              src={`/uploads/${file.filename}`}
              controls
              className="w-full"
            />
          </div>
        ) : previewContent ? (
          <div className="flex-grow flex flex-col h-full">
            <pre className="text-xs font-mono text-fg-2 bg-elevated p-3 border border-line rounded-md overflow-auto max-h-[450px] whitespace-pre-wrap select-text">
              <code>{previewContent}</code>
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-fg-4 border border-dashed border-line rounded-md">
            <FileText className="w-6 h-6 mb-2 text-fg-3" />
            <p className="text-xs font-sans">No interactive preview available</p>
            <p className="text-[10px] font-mono uppercase mt-1">Download to view file contents</p>
          </div>
        )}
      </div>
    </div>
  );
}
