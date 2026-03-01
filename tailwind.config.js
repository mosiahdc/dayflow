/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1A1A2E',
          accent: '#4F6EF7',
          accent2: '#7C3AED',
          green: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          teal: '#0D9488',
          muted: '#94A3B8',
          border: '#E2E8F0',
          bg: '#F8F9FF',
        },
      },
    },
  },
  plugins: [],
};