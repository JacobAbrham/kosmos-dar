/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // KOSMOS brand colors
        kosmos: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#f59e0b',
        },
        // Agent colors
        agent: {
          zeus: '#ffd700',
          hermes: '#4ade80',
          aegis: '#ef4444',
          athena: '#8b5cf6',
          chronos: '#3b82f6',
          hephaestus: '#f97316',
          prometheus: '#14b8a6',
          iris: '#ec4899',
          memorix: '#06b6d4',
          hestia: '#84cc16',
          morpheus: '#a855f7',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        typing: {
          '0%, 60%, 100%': { opacity: '0.3' },
          '30%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
