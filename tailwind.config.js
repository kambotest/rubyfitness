/** @type {import('tailwindcss').Config} */
//
// Palette: warm-neutral base, pinks and warm pastels as accents.
// No green/plum prominence in branding — those tokens still exist for
// utility use (e.g. plant ring, water ring) but the dominant brand
// language is rose / blush / peach over linen and stone.
//
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ---- Neutrals (the base) ----
        canvas:   '#FAFAF7',
        cream:    '#FAFAF7',  // alias
        linen:    '#F2EFE8',
        sand:     '#F2EFE8',  // alias
        stone:    '#E5E1D8',
        biscuit:  '#E5E1D8',  // alias
        mushroom: '#B6AEA0',
        clay:     '#B6AEA0',  // alias
        slate:    '#6F6A62',
        muted:    '#6F6A62',  // alias
        charcoal: '#2A2823',
        ink:      '#2A2823',  // alias

        // ---- Pinks (the brand accent family) ----
        // pale -> medium -> deeper, all warm-rose biased
        petal:    '#FBE8E4',  // softest pink wash
        blush:    '#F5DAD7',
        rose:     '#E5B7B3',  // a touch warmer + deeper than the previous rose
        dusty:    '#C99097',  // primary brand rose for the wordmark
        coral:    '#E0A38B',
        peach:    '#F5D9C0',

        // ---- Warm yellows ----
        butter:   '#F5E8C0',
        amber:    '#E5C28A',

        // ---- Cool support tones (used sparingly) ----
        sage:     '#C8E0D2',  // plant accents only
        moss:     '#7FA88E',  // plant ring
        sky:      '#C5DCE5',  // hydration light
        ocean:    '#7C9FB0',  // hydration deeper
        lavender: '#DDD3E8',
        plum:     '#8B7BA0',  // legacy alias, used for body text emphasis
      },
      boxShadow: {
        soft:    '0 1px 2px rgba(42,40,35,0.04), 0 12px 32px rgba(42,40,35,0.06)',
        whisper: '0 1px 2px rgba(42,40,35,0.03), 0 6px 18px rgba(42,40,35,0.04)',
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
