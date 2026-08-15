/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0B',
        surface: '#111113',
        elevated: '#17171A',
        hover: '#1F1F23',
        line: '#242429',
        'line-2': '#2E2E35',
        'line-3': '#3D3D47',
        fg: '#F4F4F5',
        'fg-2': '#A1A1AA',
        'fg-3': '#71717A',
        'fg-4': '#52525B',
        accent: '#FF8A3D',
        'accent-2': '#E67328',
        'accent-3': '#FFA466',
        'accent-bg': 'rgba(255, 138, 61, 0.08)',
        'accent-bd': 'rgba(255, 138, 61, 0.28)',
        ok: '#6b9a78',
        warn: '#b8956a',
        bad: '#b87470',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        breathe: 'breathe 3.2s ease-in-out infinite',
        pulse2: 'dotPulse 2.4s ease-in-out infinite',
        fadeIn: 'fadeIn 250ms ease forwards',
        scaleIn: 'scaleIn 200ms ease forwards',
        slideUp: 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(0.7)' },
        },
        dotPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(107,154,120,0.3)' },
          '50%': { boxShadow: '0 0 0 4px rgba(107,154,120,0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
