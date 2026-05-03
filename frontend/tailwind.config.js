/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ae: {
          bg: '#fcf9f5',
          surface: '#ffffff',
          surfaceSoft: '#f6f3ef',
          surfaceMuted: '#f0edea',
          border: '#cdc6bb',
          borderStrong: '#b8b0a4',
          text: '#1c1c1a',
          textMuted: '#5b564d',
          primary: '#655e4e',
          primarySoft: '#a89f8d',
          primaryFaint: '#ece1cd',
          danger: '#ba1a1a',
          dangerSoft: '#ffdad6',
          darkSurface: '#191816',
          darkCard: '#22211f',
          darkBorder: '#4f4b44',
          darkText: '#f3f0ec',
          darkTextMuted: '#d0c9be',
        },
      },
      fontFamily: {
        sans: [
          '"Space Grotesk"',
          '"Segoe UI"',
          '"Microsoft JhengHei"',
          '"微軟正黑體"',
          'sans-serif',
        ],
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
