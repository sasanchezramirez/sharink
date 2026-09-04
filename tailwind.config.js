/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#0f1117',
        darkCard: '#181b24',
        darkBorder: '#272b38',
      }
    },
  },
  plugins: [],
}
