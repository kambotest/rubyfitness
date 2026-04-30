/** @type {import('tailwindcss').Config} */
//
// Palette philosophy: warm-neutral base, pastel accents used sparingly.
// Token names are kept stable so existing className references keep
// working — only the hex values shifted. The "deeper" accents (moss,
// rose, plum, ocean) are still pastels, just a notch saturated for
// legibility on solid backgrounds; the "lighter" siblings (sage, blush,
// lavender, sky, butter, peach, mint) are airy washes.
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
        canvas:   '#FAFAF7',  // page background
        cream:    '#FAFAF7',  // alias
        linen:    '#F2EFE8',  // card surface, soft fill
        sand:     '#F2EFE8',  // alias
        stone:    '#E5E1D8',  // dividers, hover
        biscuit:  '#E5E1D8',  // alias
        mushroom: '#B6AEA0',  // medium neutral
        clay:     '#B6AEA0',  // alias
        slate:    '#6F6A62',  // muted text
        muted:    '#6F6A62',  // alias
        charcoal: '#2A2823',  // primary text
        ink:      '#2A2823',  // alias

        // ---- Pastel accents ----
        // light / medium pairs so backgrounds and text/buttons can
        // reference different members of the same hue family.
        sage:     '#C8E0D2',  // pale mint
        moss:     '#7FA88E',  // deeper green for buttons / accents
        blush:    '#F5DAD7',  // pale pink
        rose:     '#DDA8A6',  // deeper rose
        butter:   '#F5E8C0',  // pale yellow
        amber:    '#E5C28A',  // deeper warm yellow
        lavender: '#DDD3E8',  // pale purple
        plum:     '#8B7BA0',  // deeper plum
        sky:      '#C5DCE5',  // pale blue
        ocean:    '#7C9FB0',  // deeper blue
        peach:    '#F5D9C0',  // pale peach
        coral:    '#E0A38B',  // deeper warm coral
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42,40,35,0.04), 0 12px 32px rgba(42,40,35,0.06)',
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
