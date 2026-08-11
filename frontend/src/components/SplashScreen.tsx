'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Bot, Zap, ArrowRight } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [stage, setStage] = useState<'animating' | 'ready' | 'exiting'>('animating');

  useEffect(() => {
    // Stage 1: Animation sequence (1.8s)
    const timer1 = setTimeout(() => {
      setStage('ready');
    }, 1800);

    return () => clearTimeout(timer1);
  }, []);

  const handleEnter = () => {
    setStage('exiting');
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 500);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0d14] text-white transition-opacity duration-500 ease-in-out ${
        stage === 'exiting' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[500px] md:h-[500px] bg-gradient-to-tr from-[#4DE8F0]/20 to-[#9D7BFF]/20 rounded-full blur-[100px] pointer-events-none animate-pulse" />

      {/* Main Animated Icon Container */}
      <div className="relative flex flex-col items-center gap-6 z-10 px-4 text-center">
        <div className="relative flex items-center justify-center">
          {/* Rotating halo ring */}
          <div className="absolute w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-transparent border-t-[#4DE8F0] border-r-[#9D7BFF] animate-spin" style={{ animationDuration: '3s' }} />

          {/* Inner pulsating icon box */}
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-[#121824] to-[#1e293b] border border-[#4DE8F0]/40 flex items-center justify-center shadow-[0_0_40px_rgba(77,232,240,0.3)] transition-transform duration-700 hover:scale-105">
            <Bot className="w-10 h-10 md:w-14 md:h-14 text-[#4DE8F0] animate-bounce" style={{ animationDuration: '2s' }} />
          </div>

          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#9D7BFF] animate-pulse" />
          <Zap className="absolute -bottom-1 -left-2 w-5 h-5 text-[#4DE8F0] animate-pulse" />
        </div>

        {/* Branding & Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#4DE8F0] via-white to-[#9D7BFF]">
            CHAT-Y
          </h1>
          <p className="text-xs md:text-sm font-mono text-gray-400 tracking-widest uppercase">
            Integrated WebLLM & Multi-Cloud Workspace
          </p>
        </div>

        {/* Provider Badges */}
        <div className="flex flex-wrap justify-center items-center gap-2 mt-2 max-w-md">
          {['WebLLM (Local)', 'Groq', 'Gemini', 'OpenRouter', 'NVIDIA NIM'].map((tag) => (
            <span
              key={tag}
              className="text-[10px] md:text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-mono"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Enter Button or Loading Indicator */}
        <div className="mt-6 min-h-[44px] flex items-center justify-center">
          {stage === 'animating' ? (
            <div className="flex items-center gap-2 text-xs font-mono text-[#4DE8F0]">
              <div className="w-2 h-2 rounded-full bg-[#4DE8F0] animate-ping" />
              Initializing workspace engine...
            </div>
          ) : (
            <button
              onClick={handleEnter}
              className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4DE8F0] to-[#9D7BFF] text-black font-semibold text-sm shadow-[0_0_25px_rgba(77,232,240,0.4)] hover:shadow-[0_0_35px_rgba(157,123,255,0.6)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Enter Chat-Y Workspace</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
