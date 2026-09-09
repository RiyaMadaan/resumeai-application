/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: indigo/violet identity
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // primary
          600: '#4f46e5', // primary hover / core brand
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          // Violet accent for gradients & sparkle
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        ink: {
          // Text scale on light backgrounds
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Tuned display scale for hero/headlines
        'display-sm': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-lg': ['4rem', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '800' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        card: '0 4px 24px rgba(15, 23, 42, 0.08)',
        lift: '0 12px 40px rgba(79, 70, 229, 0.16)',
        glow: '0 0 0 1px rgba(99, 102, 241, 0.12), 0 8px 32px rgba(99, 102, 241, 0.22)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #faf5ff 100%)',
        'hero-radial': 'radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, rgba(255,255,255,0) 70%)',
      },
      maxWidth: {
        container: '1200px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'sparkle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.82)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.6s ease-out both',
        'sparkle': 'sparkle 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
