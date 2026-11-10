import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          light: '#F4F0FD',
          dark: '#5B21B6',
        },
        secondary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#EEF2FF',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#F0FDF4',
        },
        error: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FFFBEB',
        },
        'text-primary': '#0F112E',
        'text-secondary': '#5E6488',
        surface: '#F4F3FA',
        border: '#E4E2F0',
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 2px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
