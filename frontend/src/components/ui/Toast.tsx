'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export function Toast() {
  const { state, dispatch } = useApp();

  const handleDismiss = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  if (!state.toasts || state.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {state.toasts.map((toast) => {
        let borderClass = 'border-line';
        let icon = <Info className="w-4 h-4 text-accent" />;

        if (toast.type === 'success') {
          borderClass = 'border-[#6b9a78]/30 text-[#6b9a78]';
          icon = <CheckCircle className="w-4 h-4 text-[#6b9a78]" />;
        } else if (toast.type === 'error') {
          borderClass = 'border-[#b87470]/30 text-[#b87470]';
          icon = <AlertCircle className="w-4 h-4 text-[#b87470]" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-[#b8956a]/30 text-[#b8956a]';
          icon = <AlertTriangle className="w-4 h-4 text-[#b8956a]" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 bg-surface border ${borderClass} rounded-md shadow-lg transition-all duration-200 animate-[toastIn_200ms_ease]`}
          >
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-grow text-xs font-sans text-fg">{toast.message}</div>
            <button
              onClick={() => handleDismiss(toast.id)}
              className="flex-shrink-0 text-fg-4 hover:text-fg-2 transition-colors cursor-pointer mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
