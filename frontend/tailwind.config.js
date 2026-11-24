/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#06080d',
          900: '#0a0d14',
          850: '#0e121c',
          800: '#141a27',
          750: '#1a2233',
          700: '#222d42',
          600: '#32405d',
        },
        electric: {
          indigo: '#6366f1',
          violet: '#8b5cf6',
          purple: '#a855f7',
        },
        sunset: {
          rose: '#f43f5e',
          crimson: '#e11d48',
          blush: '#fb7185',
        },
        amberGold: {
          500: '#f59e0b',
          400: '#fbbf24',
          300: '#fcd34d',
        },
        aurora: {
          teal: '#14b8a6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-violet': '0 0 25px -5px rgba(139, 92, 246, 0.3)',
        'glow-sunset': '0 0 25px -5px rgba(244, 63, 94, 0.3)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.3)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.3)',
      }
    },
  },
  plugins: [],
}
