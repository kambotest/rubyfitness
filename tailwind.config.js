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
        // Backdrop tones
        cream:    '#FBF7F2',
        sand:     '#F1E8DC',
        // Warm neutrals
        clay:     '#D4B89D',
        biscuit:  '#E8DBC7',
        // Greens (softened — sage is the friendly accent, moss the anchor)
        sage:     '#B0C2A4',
        moss:     '#7E9777',
        // Pinks
        blush:    '#F2DCD5',
        rose:     '#D9A6A1',
        // Purples
        plum:     '#8C6E7E',
        lavender: '#CFC2D6',
        // Sky — for hydration accent
        sky:      '#B6CFDC',
        ocean:    '#7FA6BB',
        // Warm yellow accent
        butter:   '#F2E2BD',
        // Text
        ink:      '#3E3933',
        muted:    '#988E83',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(62,57,51,0.04), 0 12px 32px rgba(62,57,51,0.06)',
        whisper: '0 1px 2px rgba(62,57,51,0.03), 0 6px 18px rgba(62,57,51,0.04)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
