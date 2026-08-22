'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, Download, ArrowRight } from 'lucide-react';
import { WorkspaceEntryModal } from './modals/WorkspaceEntryModal';

interface SplashScreenProps {
  onFinish?: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState(0); // 0: logo, 1: text, 2: ready, 3: exit
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle particle/noise field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    const count = Math.min(60, Math.floor(window.innerWidth / 20));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.08;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 138, 61, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 138, 61, ${p.opacity * 0.8})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Phase progression
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const [showEntryModal, setShowEntryModal] = useState(false);

  const handleEnter = () => {
    setPhase(3);
    setTimeout(() => onFinish?.(), 600);
  };

  const handleEnterClick = () => {
    try {
      const pref = localStorage.getItem('chaty_entry_pref');
      if (pref === 'web') {
        handleEnter();
        return;
      }
    } catch {}
    setShowEntryModal(true);
  };

  // Auto-enter after delay only if user explicitly preferred web
  useEffect(() => {
    if (phase !== 2 || showEntryModal) return;
    try {
      const pref = localStorage.getItem('chaty_entry_pref');
      if (pref === 'web') {
        const autoEnter = setTimeout(handleEnter, 8000);
        return () => clearTimeout(autoEnter);
      }
    } catch {}
  }, [phase, showEntryModal]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0A0B',
        overflow: 'hidden',
        opacity: phase === 3 ? 0 : 1,
        transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top Right Quick Download Badge */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 100,
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <a
          href={process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || '/chat-y.apk'}
          download="chat-y.apk"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255, 138, 61, 0.08)',
            border: '1px solid rgba(255, 138, 61, 0.3)',
            color: '#FF8A3D',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            padding: '7px 16px',
            borderRadius: 100,
            textDecoration: 'none',
            transition: 'all 200ms ease',
            letterSpacing: '0.04em',
            userSelect: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 138, 61, 0.18)';
            e.currentTarget.style.borderColor = '#FF8A3D';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 138, 61, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 138, 61, 0.3)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <Download size={13} />
          <span>Download Android App</span>
        </a>
      </div>

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: phase >= 1 ? 0.8 : 0,
          transition: 'opacity 1.5s ease',
        }}
      />

      {/* Subtle Phosphor Amber radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          height: 420,
          background: 'radial-gradient(circle, rgba(255, 138, 61, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'opacity 2s ease',
        }}
      />

      {/* Main Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Logo mark — the same brand SVG, clean */}
        <div
          style={{
            opacity: phase >= 0 ? 1 : 0,
            transform: phase >= 0 ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            marginBottom: 24,
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="48" fill="#17171A" stroke="#2E2E35" strokeWidth="1.5"/>
            <circle cx="50" cy="50" r="44" fill="#111113"/>
            <rect x="27" y="27" width="46" height="46" rx="10" fill="#FF8A3D"/>
            <circle cx="50" cy="50" r="18" fill="#0A0A0B"/>
            <polygon points="50,40 40.5,57.5 59.5,57.5" fill="#FF8A3D"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 700ms cubic-bezier(0.16, 1, 0.3, 1) 100ms',
          }}
        >
          <h1
            style={{
              fontFamily: "'Geist', -apple-system, system-ui, sans-serif",
              fontSize: 'clamp(32px, 6vw, 48px)',
              fontWeight: 300,
              letterSpacing: '0.25em',
              color: '#F4F4F5',
              margin: 0,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            CHAT-Y
          </h1>
        </div>

        {/* Tagline — understated, elegant */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 600ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
            marginTop: 10,
          }}
        >
          <p
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: '#71717A',
              margin: 0,
              letterSpacing: '0.04em',
              userSelect: 'none',
            }}
          >
            multi-model ai workspace
          </p>
        </div>

        {/* Divider line */}
        <div
          style={{
            width: phase >= 1 ? 48 : 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255, 138, 61, 0.5), transparent)',
            marginTop: 28,
            transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1) 500ms',
          }}
        />

        {/* Action Buttons: Download Android App + Enter Workspace */}
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)',
            transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 10,
          }}
        >
          {/* Direct Download Android App Button */}
          <a
            href={process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || '/chat-y.apk'}
            download="chat-y.apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, rgba(255, 138, 61, 0.15) 0%, rgba(255, 138, 61, 0.05) 100%)',
              border: '1px solid #FF8A3D',
              color: '#FF8A3D',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '10px 22px',
              borderRadius: 100,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'all 250ms ease',
              userSelect: 'none',
              textTransform: 'uppercase',
              boxShadow: '0 0 16px rgba(255, 138, 61, 0.18)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#FF8A3D';
              e.currentTarget.style.color = '#0A0A0B';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(255, 138, 61, 0.5)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 138, 61, 0.15) 0%, rgba(255, 138, 61, 0.05) 100%)';
              e.currentTarget.style.color = '#FF8A3D';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 138, 61, 0.18)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <Smartphone size={14} />
            <span>Download Android App</span>
          </a>

          {/* Enter Workspace Button */}
          <button
            onClick={handleEnterClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#E4E4E7',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.08em',
              padding: '10px 22px',
              borderRadius: 100,
              cursor: 'pointer',
              transition: 'all 250ms ease',
              userSelect: 'none',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#E4E4E7';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span>Enter Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Subtle footer info */}
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            opacity: phase >= 2 ? 0.4 : 0,
            transition: 'opacity 600ms ease 200ms',
          }}
        >
          {['WebGPU', 'Groq', 'NVIDIA', 'OpenAI', 'Anthropic'].map(name => (
            <span
              key={name}
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: '#6b6b6b',
                letterSpacing: '0.06em',
                userSelect: 'none',
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Choice Interstitial Modal */}
      <WorkspaceEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSelectWeb={() => {
          setShowEntryModal(false);
          handleEnter();
        }}
      />
    </div>
  );
}
