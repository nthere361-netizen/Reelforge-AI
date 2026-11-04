import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        onyx: {
          950: '#0B0B0F', // Primary onyx background
          900: '#12121A', // Secondary background
          800: '#171722', // Card & panel background
          700: '#222233', // Borders & dividers
          600: '#2E2E42',
        },
        indigo: {
          electric: '#6366F1', // Primary brand action
          bright: '#818CF8',   // Glowing accents & highlights
          deep: '#4F46E5',
          faint: 'rgba(99, 102, 241, 0.12)',
        },
        txt: {
          primary: '#F5F5FA',   // High-contrast clean white
          secondary: '#A1A1B5', // Subtle muted slate
          muted: '#6B6B80',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

