/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,svelte,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        atlas: {
          50: '#eef3ff',
          100: '#d9e3ff',
          200: '#b5c6ff',
          300: '#8aa3ff',
          400: '#5e7dff',
          500: '#3d5cff',
          600: '#2a41e6',
          700: '#2031b4',
          800: '#1a278a',
          900: '#131c63',
          950: '#0a0f36',
        },
        ink: {
          50: '#f6f7fb',
          100: '#eceef6',
          200: '#d4d8e8',
          300: '#a7aec8',
          400: '#717a9d',
          500: '#4f587a',
          600: '#3a4264',
          700: '#2b3350',
          800: '#1a2037',
          900: '#0e1222',
          950: '#05070f',
        },
      },
      boxShadow: {
        glow: '0 0 60px -10px rgba(61, 92, 255, 0.45)',
      },
      animation: {
        'fade-up': 'fade-up 700ms ease-out both',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
