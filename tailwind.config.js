/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Zen Kaku Gothic New"', 'system-ui', 'sans-serif'],
        display: ['"Chakra Petch"', '"Zen Kaku Gothic New"', 'sans-serif']
      },
      colors: {
        surface: {
          DEFAULT: '#0f172a',
          raised: '#1e293b',
          deep: '#020617'
        },
        // レーシングアクセント: プライマリ操作は赤系に統一（MK8DXレッド由来）
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d'
        }
      }
    },
  },
  plugins: [],
}
