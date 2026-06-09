/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vanguard: {
          bg: '#0A0F1A',
          panel: '#111827',
          border: '#1F2937',
          acoustic: '#EF4444',
          camera: '#F59E0B',
          community: '#3B82F6',
          elevated: '#F97316',
          critical: '#DC2626',
          onehealth: '#8B5CF6',
          species: '#10B981',
          zoneClear: '#059669',
          zoneMonitor: '#D97706',
          zoneActive: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-border': 'pulseBorder 2s infinite',
      },
      keyframes: {
        pulseBorder: {
          '0%, 100%': {
            borderColor: 'rgba(220, 38, 38, 1)',
            boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.7)',
          },
          '50%': {
            borderColor: 'rgba(239, 68, 68, 0.5)',
            boxShadow: '0 0 0 10px rgba(220, 38, 38, 0)',
          },
        },
      },
    },
  },
  plugins: [],
};
