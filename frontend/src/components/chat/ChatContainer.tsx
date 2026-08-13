'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { uploadFile } from '@/lib/api';
import type { UploadedFile } from '@/types';

export function ChatContainer() {
  const { state, sendMessage, showToast } = useApp();
  const { activeConversationId } = state;
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsDragging(false);
      for (const file of acceptedFiles) {
        try {
          const uploaded = await uploadFile(file);
          setPendingFiles(prev => [...prev, uploaded]);
          showToast(`Uploaded ${file.name}`, 'success');
        } catch {
          showToast(`Failed to upload ${file.name}`, 'error');
        }
      }
    },
    [showToast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const handleSend = useCallback(
    async (content: string) => {
      const fileIds = pendingFiles.map(f => f.id);
      setPendingFiles([]);
      await sendMessage(content, fileIds);
    },
    [pendingFiles, sendMessage]
  );

  return (
    <div
      {...getRootProps()}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--bg)',
      }}
    >
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            inset: 12,
            zIndex: 50,
            background: 'rgba(122,142,170,0.04)',
            border: '2px dashed var(--accent-bd)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
            <Upload size={36} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.08em', fontWeight: 500 }}>
              DROP FILES TO ATTACH
            </p>
          </div>
        </div>
      )}

      {!activeConversationId ? (
        <WelcomeScreen />
      ) : (
        <>
          <MessageList />
          <ChatInput
            pendingFiles={pendingFiles}
            onRemoveFile={id => setPendingFiles(prev => prev.filter(f => f.id !== id))}
            onAddFile={file => setPendingFiles(prev => [...prev, file])}
            onSend={handleSend}
          />
        </>
      )}
    </div>
  );
}
