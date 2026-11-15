/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf3',
          100: '#d8f3e1',
          200: '#b3e5c6',
          300: '#82d1a4',
          400: '#4fb67e',
          500: '#2d9a62',
          600: '#1f7c4e',
          700: '#1a6341',
          800: '#174f36',
          900: '#13412e',
          950: '#0a2519',
        },
        ink: {
          50: '#f7f8f7',
          100: '#eef0ee',
          200: '#dfe3df',
          300: '#c4cbc5',
          400: '#98a39a',
          500: '#6f7b72',
          600: '#556058',
          700: '#434b45',
          800: '#2c322e',
          900: '#1a1e1b',
        },
        protein: '#e2725b',
        carbs: '#e8a838',
        fat: '#5b8def',
        canvas: '#f6f8f5',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 40, 28, 0.04), 0 4px 16px rgba(16, 40, 28, 0.05)',
        lift: '0 8px 30px rgba(16, 40, 28, 0.12)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.92)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'slide-up': 'slide-up .35s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .2s ease-out both',
        pop: 'pop .45s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
