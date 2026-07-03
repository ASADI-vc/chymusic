/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chy: {
          bg: '#0d1117',
          panel: '#161b22',
          border: '#30363d',
          fg: '#f0f6fc',
          muted: '#9198a1',
          accent: '#1db954',
          'accent-hover': '#1ed760',
          danger: '#da3633',
          warn: '#d29922',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
