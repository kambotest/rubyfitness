# Cradle

A gentle health & fitness diary for postpartum mums — voice-first, one-handed, and designed to be invisible when you don't need it.

## Why

For a new mum 6 months postpartum, with a baby in arms, the bar for "open the app, log a meal" is high. Cradle makes the bar very low:

- **Voice-first.** Hold the mic and say *"two eggs on toast and a flat white"*, or *"ran 5 km in 32 minutes"*. The app parses, calculates calories & macros, and logs.
- **One-handed.** Big tap targets, bottom-anchored navigation, no nested screens.
- **Personalised goals.** Pre-baby weight, weekly running km (e.g. 30 km), protein, fibre, and fruit/veg variety — all visible at a glance.
- **Recipes from a link or your voice.** Dictate ingredients, paste a URL, or import on the fly. Cradle splits per-serve macros and lets you log "1 serve" with one tap.
- **Progress that actually motivates.** Daily rings + weight, calories, running km, protein and variety streak over 7 / 30 / 90 / 180 days.
- **Postpartum-aware.** Breastfeeding adds ~400 kcal to your daily target; "walking with the pram" and "postnatal pilates" are first-class activities.

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
- Web Speech API for hands-free input
- ~180-item food database covering all major groups, plus a postpartum-friendly exercise database with MET-based calorie burn
