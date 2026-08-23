'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import {
  Code,
  Eye,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  FileJson,
  Terminal,
  ExternalLink,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { FileBlock } from '@/lib/fileParser';
import { downloadFile } from '@/lib/fileParser';
import { useApp } from '@/context/AppContext';

interface FileArtifactPanelProps {
  file: FileBlock;
}

function getFileTheme(type: string, name: string) {
  const ext = (name.split('.').pop() || type || '').toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return {
        label: 'HTML',
        icon: <FileCode size={15} style={{ color: '#FF8A3D' }} />,
        badgeBg: 'rgba(255, 138, 61, 0.12)',
        badgeBorder: 'rgba(255, 138, 61, 0.3)',
        badgeColor: '#FF8A3D',
        canPreview: true,
      };
    case 'css':
    case 'scss':
    case 'sass':
      return {
        label: 'CSS',
        icon: <Code size={15} style={{ color: '#38bdf8' }} />,
        badgeBg: 'rgba(56, 189, 248, 0.12)',
        badgeBorder: 'rgba(56, 189, 248, 0.3)',
        badgeColor: '#38bdf8',
        canPreview: false,
      };
    case 'js':
    case 'javascript':
    case 'jsx':
      return {
        label: 'JAVASCRIPT',
        icon: <FileCode size={15} style={{ color: '#facc15' }} />,
        badgeBg: 'rgba(250, 204, 21, 0.12)',
        badgeBorder: 'rgba(250, 204, 21, 0.3)',
        badgeColor: '#facc15',
        canPreview: false,
      };
    case 'ts':
    case 'typescript':
    case 'tsx':
      return {
        label: 'TYPESCRIPT',
        icon: <FileCode size={15} style={{ color: '#60a5fa' }} />,
        badgeBg: 'rgba(96, 165, 250, 0.12)',
        badgeBorder: 'rgba(96, 165, 250, 0.3)',
        badgeColor: '#60a5fa',
        canPreview: false,
      };
    case 'json':
      return {
        label: 'JSON',
        icon: <FileJson size={15} style={{ color: '#a78bfa' }} />,
        badgeBg: 'rgba(167, 139, 250, 0.12)',
        badgeBorder: 'rgba(167, 139, 250, 0.3)',
        badgeColor: '#a78bfa',
        canPreview: false,
      };
    case 'py':
    case 'python':
      return {
        label: 'PYTHON',
        icon: <Terminal size={15} style={{ color: '#4ade80' }} />,
        badgeBg: 'rgba(74, 222, 128, 0.12)',
        badgeBorder: 'rgba(74, 222, 128, 0.3)',
        badgeColor: '#4ade80',
        canPreview: false,
      };
    case 'md':
    case 'markdown':
      return {
        label: 'MARKDOWN',
        icon: <FileText size={15} style={{ color: '#c084fc' }} />,
        badgeBg: 'rgba(192, 132, 252, 0.12)',
        badgeBorder: 'rgba(192, 132, 252, 0.3)',
        badgeColor: '#c084fc',
        canPreview: true,
      };
    default:
      return {
        label: ext.toUpperCase() || 'FILE',
        icon: <FileText size={15} style={{ color: 'var(--fg-3)' }} />,
        badgeBg: 'var(--line-2)',
        badgeBorder: 'var(--line-3)',
        badgeColor: 'var(--fg-3)',
        canPreview: false,
      };
  }
}

export function FileArtifactPanel({ file }: FileArtifactPanelProps) {
  const { showToast } = useApp();
  const theme = useMemo(() => getFileTheme(file.type, file.name), [file.type, file.name]);

  // Default to Preview if HTML or Markdown, otherwise Code
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>(
    theme.canPreview ? 'preview' : 'code'
  );
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    showToast(`Copied ${file.name} to clipboard`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadFile(file.name, file.content, file.type);
    showToast(`Downloaded ${file.name}`, 'success');
  };

  const handleOpenInNewWindow = () => {
    if (file.type === 'html' || file.name.endsWith('.html')) {
      const blob = new Blob([file.content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  const lang = useMemo(() => {
    const ext = (file.name.split('.').pop() || file.type || '').toLowerCase();
    if (ext === 'py') return 'python';
    if (ext === 'js') return 'javascript';
    if (ext === 'ts') return 'typescript';
    if (ext === 'md') return 'markdown';
    return ext || 'plaintext';
  }, [file.name, file.type]);

  return (
    <div
      style={{
        margin: '14px 0',
        borderRadius: 10,
        background: 'var(--elevated)',
        border: '1px solid var(--line-2)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--line-2)',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Icon, Filename & Type badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {theme.icon}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fg)',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 240,
            }}
          >
            {file.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: theme.badgeColor,
              background: theme.badgeBg,
              border: `1px solid ${theme.badgeBorder}`,
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.05em',
            }}
          >
            {theme.label}
          </span>

          {file.isStreaming && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--accent)',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            >
              <Sparkles size={11} className="animate-spin" />
              <span>Generating...</span>
            </span>
          )}
        </div>

        {/* Right: Tabs & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {theme.canPreview && (
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid var(--line)',
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeTab === 'preview' ? 'var(--elevated)' : 'transparent',
                  color: activeTab === 'preview' ? 'var(--fg)' : 'var(--fg-4)',
                  boxShadow: activeTab === 'preview' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <Eye size={12} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeTab === 'code' ? 'var(--elevated)' : 'transparent',
                  color: activeTab === 'code' ? 'var(--fg)' : 'var(--fg-4)',
                  boxShadow: activeTab === 'code' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <Code size={12} />
                <span>Code</span>
              </button>
            </div>
          )}

          {/* New window button for HTML */}
          {theme.canPreview && (file.type === 'html' || file.name.endsWith('.html')) && (
            <button
              type="button"
              onClick={handleOpenInNewWindow}
              title="Open in new window"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 5,
                color: 'var(--fg-3)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--fg)';
                e.currentTarget.style.borderColor = 'var(--line-3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--fg-3)';
                e.currentTarget.style.borderColor = 'var(--line)';
              }}
            >
              <ExternalLink size={12} />
            </button>
          )}

          {/* Toggle Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(v => !v)}
            title={isExpanded ? 'Collapse size' : 'Expand size'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 5,
              color: 'var(--fg-3)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--fg)';
              e.currentTarget.style.borderColor = 'var(--line-3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--fg-3)';
              e.currentTarget.style.borderColor = 'var(--line)';
            }}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 5,
              color: copied ? 'var(--ok)' : 'var(--fg-3)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => !copied && (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => !copied && (e.currentTarget.style.color = 'var(--fg-3)')}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            title={`Download ${file.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 9px',
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-bd)',
              borderRadius: 5,
              color: 'var(--accent)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent-bg)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
          >
            <Download size={12} />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* ── Content View ── */}
      <div
        style={{
          position: 'relative',
          height: isExpanded ? '680px' : '380px',
          maxHeight: '80vh',
          minHeight: '220px',
          background: activeTab === 'preview' && (file.type === 'html' || file.name.endsWith('.html')) ? '#ffffff' : 'var(--bg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 250ms ease',
        }}
      >
        {activeTab === 'preview' && theme.canPreview ? (
          file.type === 'html' || file.name.endsWith('.html') ? (
            /* Sandboxed HTML Iframe */
            <iframe
              srcDoc={file.content || '<div style="font-family:sans-serif;color:#888;padding:20px;text-align:center;">Rendering preview...</div>'}
              sandbox="allow-scripts"
              title={file.name}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff',
              }}
            />
          ) : (
            /* Formatted Markdown Preview */
            <div
              style={{
                padding: '16px 20px',
                height: '100%',
                overflowY: 'auto',
                fontSize: 14,
                color: 'var(--fg)',
                background: 'var(--bg)',
              }}
              className="prose-dark"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {file.content || '*Rendering preview...*'}
              </ReactMarkdown>
            </div>
          )
        ) : (
          /* Code View */
          <div
            style={{
              padding: 0,
              height: '100%',
              overflow: 'auto',
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: '14px 16px',
                background: 'transparent',
                fontSize: 12.5,
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-2)',
                whiteSpace: 'pre',
                wordWrap: 'normal',
                overflowX: 'auto',
                flex: 1,
              }}
            >
              <code className={`language-${lang}`}>{file.content || ' '}</code>
              {file.isStreaming && (
                <span
                  className="streaming-cursor"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 2 }}
                >
                  █
                </span>
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
