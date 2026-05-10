import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand = warm terracotta (replaces former indigo). Used everywhere
        // (landing + app) via brand-* utilities so swapping these values
        // re-skins the whole product in one shot.
        brand: {
          50:  '#fdf6f3',
          100: '#fbe9e1',
          200: '#f6cfbe',
          300: '#efad92',
          400: '#e58866',
          500: '#d97757', // hover
          600: '#c96442', // primary
          700: '#a84e30',
          800: '#874029',
          900: '#6e3623',
          950: '#3b1c11',
        },
        // Cream = warm neutrals replacing default cool grays for backgrounds
        // and body text. Pair with `bg-cream-50` for pages, `bg-cream-100`
        // for panels, `text-cream-900` for body copy.
        cream: {
          50:  '#faf9f5',
          100: '#f5f4ed',
          200: '#ece9dc',
          300: '#ddd8c4',
          400: '#c5bfa8',
          500: '#a39d85',
          600: '#7e7864',
          700: '#5e5a4a',
          800: '#3e3b30',
          900: '#1f1e1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', '"Source Serif Pro"', 'Georgia', 'serif'],
      },
      animation: {
        'gradient-x': 'gradient-x 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.5s ease forwards',
        'fade-in': 'fade-in 0.6s ease forwards',
        'shimmer': 'shimmer 2.5s infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'glow': {
          '0%': { 'box-shadow': '0 0 20px rgba(201,100,66,0.25)' },
          '100%': { 'box-shadow': '0 0 40px rgba(201,100,66,0.55)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
      },
      backgroundSize: {
        '200%': '200%',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
