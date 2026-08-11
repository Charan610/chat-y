/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        elevated: '#161616',
        hover: '#1a1a1a',
        line: '#1f1f1f',
        'line-2': '#262626',
        'line-3': '#333333',
        fg: '#ededed',
        'fg-2': '#a1a1a1',
        'fg-3': '#6b6b6b',
        'fg-4': '#525252',
        accent: '#7a8eaa',
        'accent-2': '#5d7593',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        breathe: 'breathe 3.2s ease-in-out infinite',
        pulse2: 'dotPulse 2.4s ease-in-out infinite',
        fadeIn: 'fadeIn 220ms ease',
      },
      keyframes: {
        breathe: { '0%,100%': { opacity: '0.55', transform: 'scale(1)' }, '50%': { opacity: '0.15', transform: 'scale(0.7)' } },
        dotPulse: { '0%,100%': { boxShadow: '0 0 0 0 rgba(107,154,120,0.3)' }, '50%': { boxShadow: '0 0 0 4px rgba(107,154,120,0)' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' } },
      },
    },
  },
  plugins: [],
}
