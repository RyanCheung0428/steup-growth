/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ae: {
          // Aeon design system colors (from aeon.css)
          surface: '#FDF8F4',
          card: '#FFFFFF',
          border: '#E8DFD8',
          text: '#2D2B28',
          textMuted: '#8B8680',
          accent: '#A89B8C',
          accentDark: '#8B7D6F',
          primary: '#7C6B5A',
          primaryLight: '#9B8A79',
          danger: '#C44D4D',
          dangerLight: '#D46969',
          success: '#5A8F5A',
          warn: '#C9A44B',
          // Dark theme
          darkSurface: '#1A1A18',
          darkCard: '#242422',
          darkBorder: '#3A3A36',
          darkText: '#E8E4E0',
          darkTextMuted: '#9E9A94',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"Microsoft JhengHei"',
          '"微軟正黑體"',
          'sans-serif',
        ],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        twinkle: 'twinkle 3s ease-in-out infinite',
        drift: 'drift 20s linear infinite',
        float: 'float 6s ease-in-out infinite',
        spin: 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        drift: {
          '0%': { transform: 'translateX(0) translateY(0)' },
          '50%': { transform: 'translateX(10px) translateY(-5px)' },
          '100%': { transform: 'translateX(0) translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
