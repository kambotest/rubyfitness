# Built Different 🤍

A health and fitness diary — voice-first, one-handed, calorie-and-macro tracking with brand-accurate Australian nutrition data.

## Features

- **Brand-aware food search.** Curated AU dataset (Sanitarium, Chobani, Helga's, Mainland, Bega, Coca-Cola, Woolworths house, etc.) with per-100 NIP figures, plus a live lookup chain (your optional server proxy → Open Food Facts) for the long tail. Two-layer QA: each curated row is manufacturer-NIP-sourced and cross-checked at Woolworths; runtime Atwater 4-4-9 energy check flags any drift.
- **Serving calculator.** Serving / Grams (or mL) / Pack toggle with stepper, live macro panel (kcal, protein, carbs+sugars, fat+sat, fibre, sodium), one-tap Add.
- **Brand-aware voice.** "two Weet-Bix and a Chobani vanilla" parses each item with the right serving inference (2 biscuits = 30 g for Weet-Bix, 1 tub = 160 g for Chobani vanilla).
- **Barcode scanner + cookbook OCR.** Native `BarcodeDetector` on Android Chrome, lazy-imported `@zxing/browser` fallback for iOS Safari. Tesseract.js (or your proxy's Google Vision endpoint) extracts ingredient lines from photographed cookbook pages.
- **Tap-to-edit log entries.** Tap any food on the home screen to change amount, mode, meal slot — macros recompute live from the same engine used at log time.
- **Favourites + last-serving prefill.** Star any item (curated or live) — its full nutrition data is cached locally so future opens are instant and offline. Re-opening a brand prefills the last amount and unit; everything stays adjustable.
- **Evidence-based BMR/TDEE.** Mifflin-St Jeor BMR, FAO/WHO PAL multipliers, postpartum-safe deficit floors, configurable rate (0–0.5 kg/week). HbA1c-stable macro strategy (1.8 g/kg protein, carbs ≤ 45 % kcal) or the standard balanced split.
- **5-ring home screen.** Calories, protein, fibre, sugar (vs cap), and distinct plant species this week (default goal: 50). Sugar ring turns rose-red when over cap.
- **Daily Goals tab.** Editable checklist of recurring habits. Time-based goals get an inline timer button — tap to start, auto-ticks on expiry, survives app close. All-complete celebration with confetti and animated tick.
- **Recipes.** Dictate ingredients, paste a URL, or photograph a printed recipe page. Per-serve macros, save to a recipe book, log "1 serve" with one tap.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`). Best on mobile — install as a PWA via your browser's "Add to Home Screen".

## Privacy

Everything lives in your browser's local storage. Use **Settings → Export data** to back up a JSON file.

## Stack

- React + Vite + Tailwind CSS
- Recharts for progress visualisations
- Web Speech API for voice input
- Native BarcodeDetector + lazy-loaded @zxing/browser fallback for barcode scanning
- Lazy-loaded Tesseract.js for cookbook OCR
- Open Food Facts as the community-data fallback in the brand-lookup chain
- Optional server proxy (Cloudflare Worker reference under `/server-proxy/`) for Woolworths/manufacturer NIP scraping
