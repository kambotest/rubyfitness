/** @type {import('tailwindcss').Config} */
//
// Palette: warm-neutral oat / latte base, choc-brown text, caramel accents.
// Token names retained where possible so existing className references
// (text-charcoal, bg-blush, etc.) still work — only the underlying hex
// values shifted toward the brown family.
//
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter Tight"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Inter Tight"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // ---- Latte / oat base ----
        canvas:   '#FAF6EE',  // oat-milk page background
        cream:    '#FAF6EE',  // alias
        oat:      '#F0E6D2',  // soft oat
        linen:    '#F0E6D2',  // alias
        latte:    '#E1CDA8',  // latte foam
        stone:    '#E5DAC2',  // soft divider
        biscuit:  '#E5DAC2',  // alias
        sand:     '#E1CDA8',  // alias
        // ---- Browns (text + accents) ----
        cocoa:    '#5C4030',  // medium brown (subheadings, secondary)
        chocolate:'#3E2A1F',  // dark chocolate (primary text)
        ink:      '#3E2A1F',  // alias for primary text
        charcoal: '#3E2A1F',  // alias
        mocha:    '#7B5A41',  // softer brown
        muted:    '#9A8470',  // warm taupe (secondary text)
        slate:    '#9A8470',  // alias
        mushroom: '#B8A38C',
        clay:     '#B8A38C',  // alias
        // ---- Warm accents (caramel + soft blush layered into the warm base) ----
        caramel:  '#C19A6B',  // primary brand accent (was dusty)
        dusty:    '#C19A6B',  // alias for any existing references
        butterscotch: '#D4A574',
        amber:    '#D4A574',  // alias
        toast:    '#A47551',  // toasted accent
        coral:    '#B8765C',  // warm
        // ---- Rose family (kept for sugar/heart accents but warmer) ----
        blush:    '#F2DFC9',  // pale latte-pink
        petal:    '#F8EBD9',  // softest
        rose:     '#D4A37C',  // dusty terracotta-rose
        // ---- Cool support (used sparingly for plant/water rings) ----
        sage:     '#C8D3B8',  // muted sage that fits with browns
        moss:     '#8FA47A',
        sky:      '#C5D0CC',  // muted teal-grey
        ocean:    '#7A8E89',
        plum:     '#6B5142',  // shifted into brown family
        lavender: '#D8C9C0',
      },
      boxShadow: {
        soft:    '0 1px 2px rgba(62,42,31,0.05), 0 12px 32px rgba(62,42,31,0.06)',
        whisper: '0 1px 2px rgba(62,42,31,0.04), 0 6px 18px rgba(62,42,31,0.04)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
    },
  },
  plugins: [],
};
