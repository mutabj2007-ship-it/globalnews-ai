import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: '#080b12',
        surface: {
          DEFAULT: '#0f1420',
          hover: '#141b2b',
          raised: '#161d2c',
        },
        border: {
          DEFAULT: '#1e2636',
          strong: '#2a3548',
        },
        signal: {
          DEFAULT: '#3d6fff',
          bright: '#6c93ff',
          dim: '#1e3a8a',
        },
        ice: '#a8c5ff',
        ink: {
          primary: '#edeff5',
          secondary: '#93a0b8',
          tertiary: '#5c6780',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(61,111,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(61,111,255,0.06) 1px, transparent 1px)',
        'hero-glow':
          'radial-gradient(circle at 50% 0%, rgba(61,111,255,0.22), transparent 60%)',
      },
      backgroundSize: {
        grid: '48px 48px',
      },
      keyframes: {
        'ring-pulse': {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '70%': { opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'fade-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-slide-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'ring-pulse': 'ring-pulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'fade-slide-in': 'fade-slide-in 0.4s ease-out forwards',
        'fade-slide-out': 'fade-slide-out 0.4s ease-in forwards',
      },
    },
  },
  plugins: [],
};

export default config;
