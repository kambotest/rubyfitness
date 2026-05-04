// Curated science-grounded facts about exercise, parenting, health and
// nutrition. Mixed 50/50 with quotes on the Home screen — the day's
// pick is deterministic per date so it stays stable through the day.
//
// Each fact is short enough to fit comfortably in a card. Sources are
// general consensus from peer-reviewed literature; we don't cite per-
// fact to keep the UI clean.

export const SCI_FACTS = [
  // ---- Exercise ----
  { text: 'Resistance training preserves roughly 60% more lean mass during weight loss than dieting alone.', tag: 'exercise' },
  { text: 'A 10-minute walk after a meal can reduce post-meal blood glucose by ~22%.', tag: 'exercise' },
  { text: 'Walking 8,000 steps a day is associated with most of the longevity benefit seen at 12,000+.', tag: 'exercise' },
  { text: 'Two sessions of strength work a week is enough to maintain bone density in adults over 30.', tag: 'exercise' },
  { text: 'Moderate exercise improves sleep quality more reliably than any over-the-counter sleep aid.', tag: 'exercise' },
  { text: 'Pelvic-floor strength typically takes 12–16 weeks of consistent practice to rebuild post-birth.', tag: 'exercise' },
  { text: 'High-intensity intervals at ~80% effort improve VO₂max twice as fast as steady cardio.', tag: 'exercise' },

  // ---- Nutrition ----
  { text: '30 grams of protein at breakfast correlates with better appetite control across the day.', tag: 'nutrition' },
  { text: 'Diverse plant intake (30+ species/week) is the single strongest dietary predictor of microbiome health.', tag: 'nutrition' },
  { text: 'Whole-food sugars in fruit raise blood glucose ~40% slower than the same dose from juice.', tag: 'nutrition' },
  { text: 'Meeting 25–30g of fibre a day is linked to lower all-cause mortality across cohort studies.', tag: 'nutrition' },
  { text: 'Hydration of 30–40 mL per kg body weight covers most adults under normal conditions.', tag: 'nutrition' },
  { text: 'Iron absorption from plant sources doubles when paired with vitamin C in the same meal.', tag: 'nutrition' },
  { text: 'Magnesium supports over 300 enzymatic reactions including muscle recovery and sleep.', tag: 'nutrition' },
  { text: 'Replacing one daily soft drink with water reduces 5-year weight gain by an average of 1 kg.', tag: 'nutrition' },

  // ---- Health / postpartum ----
  { text: 'Glucose tolerance can take 6–12 months to fully normalise after pregnancy.', tag: 'health' },
  { text: 'Breastfeeding burns roughly 400–500 kcal/day in the first 6 months postpartum.', tag: 'health' },
  { text: 'Cold water exposure for 2–3 minutes triggers a measurable mood lift via norepinephrine.', tag: 'health' },
  { text: '7+ hours of sleep is linked to a 30% lower rate of upper-respiratory infections.', tag: 'health' },
  { text: 'Even brief outdoor time daily improves vitamin D status enough to affect bone turnover markers.', tag: 'health' },
  { text: 'Chronic stress raises cortisol, which preferentially stores fat around the abdomen.', tag: 'health' },
  { text: "Postpartum thyroid changes affect roughly 5–10% of women in the first year — worth a check if energy stays low.", tag: 'health' },

  // ---- Parenting ----
  { text: "Children mirror their parents' food preferences in ~70% of dietary patterns by age 4.", tag: 'parenting' },
  { text: 'Reading aloud 15 minutes a day from infancy is the strongest single predictor of later reading fluency.', tag: 'parenting' },
  { text: 'Outdoor play in the first 5 years is associated with lower rates of myopia in adolescence.', tag: 'parenting' },
  { text: 'Children sleep better when their bedtime routine starts the same way each night, regardless of the activities.', tag: 'parenting' },
  { text: 'Naming an emotion ("you seem frustrated") helps a young child regulate it within ~30 seconds on average.', tag: 'parenting' },
  { text: 'A parent answering "I don\'t know, let\'s find out" models curiosity better than supplying a quick answer.', tag: 'parenting' },
];

// Deterministic pick by ISO date so it doesn't flicker.
export function factForDate(isoDate) {
  if (!SCI_FACTS.length) return null;
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return SCI_FACTS[h % SCI_FACTS.length];
}

// Decide whether today shows a quote or a fact (alternates predictably).
export function shouldShowFactToday(isoDate) {
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return h % 2 === 0;
}
