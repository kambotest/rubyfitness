/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#FBF7F2',
        sand: '#F2EADF',
        clay: '#C9A98C',
        sage: '#8FA487',
        moss: '#5E7257',
        rose: '#D9A6A1',
        plum: '#6B4F60',
        ink: '#2E2A26',
        muted: '#8A8078',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(46,42,38,0.04), 0 8px 24px rgba(46,42,38,0.06)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
