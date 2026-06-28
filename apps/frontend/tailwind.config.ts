import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5FC',
          100: '#D6E7F8',
          200: '#AED0F1',
          300: '#7FB3E8',
          400: '#4A8FDB',
          500: '#1F6FC4',
          600: '#0A4DA3',
          700: '#083E84',
          800: '#073066',
          900: '#062449',
        },
        accent: {
          50: '#ECFBFD',
          100: '#D2F5FA',
          200: '#A6EBF6',
          300: '#71DEEF',
          400: '#3DCDE5',
          500: '#14C7E0',
          600: '#0FA3BC',
          700: '#0C7F94',
          800: '#0A5F70',
          900: '#073F4A',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 8px -2px rgb(15 23 42 / 0.06)',
        card: '0 2px 4px -1px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        popover: '0 8px 24px -4px rgb(15 23 42 / 0.12), 0 2px 8px -2px rgb(15 23 42 / 0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        shimmer: 'shimmer 1.6s infinite linear',
        'scale-in': 'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
