'use client';

import React, { useEffect, useState, useRef } from 'react';

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
            const alpha = (1 - dist / 120) * 0.06;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(122, 142, 170, ${alpha})`;
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
        ctx.fillStyle = `rgba(122, 142, 170, ${p.opacity})`;
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

  const handleEnter = () => {
    setPhase(3);
    setTimeout(() => onFinish?.(), 600);
  };

  // Auto-enter after delay if user doesn't click
  useEffect(() => {
    if (phase !== 2) return;
    const autoEnter = setTimeout(handleEnter, 8000);
    return () => clearTimeout(autoEnter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
        background: '#09090b',
        overflow: 'hidden',
        opacity: phase === 3 ? 0 : 1,
        transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: phase === 2 ? 'pointer' : 'default',
      }}
      onClick={phase === 2 ? handleEnter : undefined}
    >
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

      {/* Subtle radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(122,142,170,0.06) 0%, transparent 70%)',
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
            <circle cx="50" cy="50" r="48" fill="#141414" stroke="#252525" strokeWidth="1.5"/>
            <circle cx="50" cy="50" r="44" fill="#111111"/>
            <rect x="27" y="27" width="46" height="46" rx="10" fill="#ededed"/>
            <circle cx="50" cy="50" r="18" fill="#09090b"/>
            <polygon points="50,40 40.5,57.5 59.5,57.5" fill="#ededed"/>
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
              color: '#ededed',
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
              color: '#6b6b6b',
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
            background: 'linear-gradient(90deg, transparent, rgba(122,142,170,0.4), transparent)',
            marginTop: 28,
            transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1) 500ms',
          }}
        />

        {/* Enter prompt */}
        <div
          style={{
            marginTop: 28,
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)',
            transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <button
            onClick={handleEnter}
            style={{
              background: 'none',
              border: '1px solid rgba(122,142,170,0.2)',
              color: '#a1a1a1',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.12em',
              padding: '10px 28px',
              borderRadius: 100,
              cursor: 'pointer',
              transition: 'all 300ms ease',
              userSelect: 'none',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(122,142,170,0.5)';
              e.currentTarget.style.color = '#ededed';
              e.currentTarget.style.background = 'rgba(122,142,170,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(122,142,170,0.2)';
              e.currentTarget.style.color = '#a1a1a1';
              e.currentTarget.style.background = 'none';
            }}
          >
            enter workspace →
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
    </div>
  );
}
