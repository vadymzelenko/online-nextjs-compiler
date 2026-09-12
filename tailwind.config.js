/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#1e1e1e',
          panel: '#252526',
          border: '#2d2d2d',
        },
      },
    },
  },
  plugins: [],
};
