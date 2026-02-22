/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        electric: '#38BDF8',
        'electric-2': '#7DD3FC',
        azure: '#3B82F6',
        'azure-dark': '#1D4ED8',
        ice: '#BAE6FD',
        obsidian: '#050709',
        void: '#0A0D12',
        surface: '#0D1119',
        panel: '#141B27',
        frost: '#E8EFF8',
        mist: '#B4C8E4',
        // compat
        ink: '#0D0F12',
        slate: '#12161C',
        ocean: '#0E5CAD',
        ember: '#E26B2B',
        moss: '#2D6A4F',
      },
      fontFamily: {
        display: ['"Syne"', 'ui-sans-serif', 'system-ui'],
        body:    ['"DM Sans"', 'ui-sans-serif', 'system-ui'],
        mono:    ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-electric': '0 0 40px rgba(56,189,248,0.25)',
        'glow-blue':     '0 0 40px rgba(59,130,246,0.25)',
        'card':          '0 8px 32px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
