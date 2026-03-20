/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f0f9',
          100: '#c5d5ef',
          200: '#9fb9e4',
          300: '#789cd9',
          400: '#5b87d1',
          500: '#3d72c9',
          600: '#2e5fa8',
          700: '#1e3a5f',
          800: '#162d4a',
          900: '#0e1f33',
        },
        accent: {
          50: '#fff3e0',
          100: '#ffe0b2',
          200: '#ffcc80',
          300: '#ffb74d',
          400: '#ffa726',
          500: '#f97316',
          600: '#e65c00',
          700: '#cc4400',
          800: '#b33300',
          900: '#992200',
        },
      },
      fontFamily: {
        hebrew: ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
