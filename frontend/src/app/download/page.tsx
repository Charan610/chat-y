'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Download,
  ShieldCheck,
  Zap,
  Bot,
  Database,
  Lock,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function DownloadPage() {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const installUrl =
    process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || '/chat-y.apk';
  const sha256Checksum =
    '68f34ccae88516264cfaadeaaad08ecd7eed3d79db84c5615c86f1f96e151339';
  const repoUrl = 'https://github.com/Charan610/chat-y';

  const handleCopySha = () => {
    navigator.clipboard.writeText(sha256Checksum);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background: '#0A0A0B',
        color: '#F4F4F5',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      {/* Background glowing gradients */}
      <div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{ background: '#4FB8A6' }}
      />
      <div
        className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full pointer-events-none opacity-15 blur-3xl"
        style={{ background: '#C9873C' }}
      />

      {/* Top back navigation */}
      <div className="w-full max-w-xl mb-6 z-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors py-2 px-3 rounded-lg hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800"
        >
          <ArrowLeft size={16} />
          Back to Workspace
        </Link>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full border"
          style={{
            background: 'rgba(79, 184, 166, 0.1)',
            borderColor: 'rgba(79, 184, 166, 0.3)',
            color: '#4FB8A6',
          }}
        >
          v1.0.0 Native Release
        </span>
      </div>

      {/* Main Download Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl z-10 rounded-2xl border p-6 sm:p-8 relative backdrop-blur-xl"
        style={{
          background: 'rgba(17, 17, 19, 0.85)',
          borderColor: '#242429',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7)',
        }}
      >
        {/* App Icon & Badge */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #17171A 0%, #111113 100%)',
              borderColor: 'rgba(79, 184, 166, 0.35)',
            }}
          >
            <Smartphone size={32} style={{ color: '#4FB8A6' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Chat-Y <span style={{ color: '#4FB8A6' }}>Android</span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Native Client • Same AI • Zero Shared Web Code
            </p>
          </div>
        </div>

        {/* Short Description */}
        <p className="text-zinc-300 text-sm leading-relaxed mb-6">
          Chat-Y for Android brings the full multi-cloud AI workspace, Room offline-first message caching, autonomous Jarvis system reasoning, and hardware Keystore security straight to your device.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div
            className="p-3 rounded-xl border flex flex-col gap-1.5"
            style={{ background: '#17171A', borderColor: '#2E2E35' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#4FB8A6' }}>
              <Zap size={14} />
              <span>Jetpack Compose</span>
            </div>
            <p className="text-xs text-zinc-400">100% native UI with smooth streaming tokens.</p>
          </div>

          <div
            className="p-3 rounded-xl border flex flex-col gap-1.5"
            style={{ background: '#17171A', borderColor: '#2E2E35' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#C9873C' }}>
              <Bot size={14} />
              <span>Jarvis Mode</span>
            </div>
            <p className="text-xs text-zinc-400">Plan → Step → Result execution trace.</p>
          </div>

          <div
            className="p-3 rounded-xl border flex flex-col gap-1.5"
            style={{ background: '#17171A', borderColor: '#2E2E35' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#4FB8A6' }}>
              <Database size={14} />
              <span>Room Offline Cache</span>
            </div>
            <p className="text-xs text-zinc-400">Instant offline read & conversation mirror.</p>
          </div>

          <div
            className="p-3 rounded-xl border flex flex-col gap-1.5"
            style={{ background: '#17171A', borderColor: '#2E2E35' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#C9873C' }}>
              <Lock size={14} />
              <span>Keystore AES-256</span>
            </div>
            <p className="text-xs text-zinc-400">Encrypted storage for Workspace User ID.</p>
          </div>
        </div>

        {/* Primary CTA Button */}
        <a
          href={installUrl}
          download="chat-y.apk"
          className="w-full py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm transition-all duration-200 shadow-lg active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #4FB8A6 0%, #33877A 100%)',
            color: '#0A0A0B',
            boxShadow: '0 4px 20px rgba(79, 184, 166, 0.25)',
          }}
        >
          <Download size={18} />
          <span>Direct Download APK (17 MB)</span>
        </a>

        {/* Version & Build Info */}
        <div className="flex items-center justify-between text-xs text-zinc-500 mt-4 px-1 font-mono">
          <span>Target: Android 8.0+ (API 26+)</span>
          <span>Updated: August 2026</span>
        </div>

        <div className="my-6 border-t" style={{ borderColor: '#242429' }} />

        {/* Secondary Expandable "Verify this build" */}
        <div>
          <button
            onClick={() => setVerifyOpen(!verifyOpen)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors py-1"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} style={{ color: '#4FB8A6' }} />
              Verify this build & source integrity
            </span>
            {verifyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {verifyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3 text-xs"
              >
                <div
                  className="p-3.5 rounded-xl border flex flex-col gap-2 font-mono text-[11px]"
                  style={{ background: '#0A0A0B', borderColor: '#2E2E35' }}
                >
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>SHA-256 Checksum:</span>
                    <button
                      onClick={handleCopySha}
                      className="inline-flex items-center gap-1 text-[10px] text-teal-400 hover:underline"
                    >
                      {copiedSha ? (
                        <>
                          <CheckCircle2 size={11} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> Copy SHA
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-zinc-300 break-all bg-zinc-900/80 p-2 rounded border border-zinc-800">
                    {sha256Checksum}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-zinc-400">
                    <span>Source Repository:</span>
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-400 hover:underline"
                    >
                      GitHub Repo <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
