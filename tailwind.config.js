/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // University of Cape Coast colours: Cosmic Cobalt, Aureolin, Vermilion
        cobalt: { 50: '#EEEEFB', 100: '#DCDBF6', 200: '#B7B6EC', 300: '#8F8DE0', 400: '#6461CF', 500: '#4441B5', 600: '#2E2D88', 700: '#25246E', 800: '#1C1B54', 900: '#13123A' },
        aureolin: { 300: '#FFF45C', 400: '#FDEE00', 500: '#E9D800' },
        vermilion: { 400: '#EE6A5E', 500: '#E34234', 600: '#C53022' },
        ink: { 400: '#7A7F93', 500: '#5B6074', 700: '#2B2F3D', 900: '#14161F' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        float: '0 8px 30px -6px rgba(20, 18, 58, 0.25), 0 2px 6px rgba(20, 18, 58, 0.08)',
        sheet: '0 -10px 40px -10px rgba(20, 18, 58, 0.30)',
      },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(0.6)', opacity: '0.7' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        pulseRing: 'pulseRing 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        slideUp: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        fadeIn: 'fadeIn 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
