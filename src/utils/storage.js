// Lightweight localStorage store. Single JSON blob keyed by date for entries.
// Storage key is intentionally retained as the original 'cradle:v1' so that
// existing user data survives the rebrand to "Built Different 🤍".
const KEY = 'cradle:v1';

const empty = () => ({
  profile: {
    name: '',
    weightKg: 72,
    heightCm: 165,
    age: 32,
    activity: 1.45,           // PAL multiplier
    breastfeeding: true,      // adds ~400 kcal
  },
  goals: {
    weightKg: 65,
    weeklyKm: 30,
    proteinG: 110,
    fiberG: 30,
    sugarG: 25,
    plantsPerWeek: 50,        // distinct plant species per 7-day window
    targetDate: null,
    weightLossKgPerWeek: 0.35,
    macroStrategy: 'hba1c',
  },
  weights: [],                // [{date, kg}]
  foodEntries: [],            // [{id,date,foodId,name,amount,unit,kcal,protein,carbs,fat,fiber,sugars?,sodium?,group?,brandFoodId?,meal,raw}]
  exerciseEntries: [],        // [{id,date,exerciseId,name,minutes,km,kcal,raw}]
  recipes: [],                // [{id,name,servings,items,perServe:{kcal,protein,carbs,fat,fiber}}]
  favouriteBrands: [],        // [brandFoodId, ...]
  brandUsage: {},             // { [brandFoodId]: {lastAmount, lastMode, count, lastDate} }
  cachedBrands: {},           // { [brandFoodId]: <full brand-food object> } — live results
                              // (Open Food Facts / proxy) the user starred or logged, so they
                              // resolve instantly + offline next time without re-fetching.
  dailyGoals: [               // Editable daily checklist shown on the Goals tab.
    { id: 'goal_screenfree', label: '30 min screen-free leisure time' },
    { id: 'goal_clean',      label: '30 min deep clean' },
    { id: 'goal_creatine',   label: 'Take creatine' },
    { id: 'goal_instagram',  label: '1 post on my Instagram pages' },
    { id: 'goal_meditation', label: '2 minutes meditation' },
  ],
  dailyChecks: {},            // { [iso-date]: { [goalId]: bool } }
  goalTimers: {},             // { [goalId]: { startedAt: ms, durationSec, date } } —
                              // active countdowns. Wall-clock based so they keep
                              // running while the app is closed; auto-tick the goal
                              // on expiry.
  settings: {
    proxyEndpoint: '',         // optional Woolworths/manufacturer lookup proxy
    enableOFF: true,           // fall back to Open Food Facts
  },
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    const base = empty();
    return {
      ...base,
      ...parsed,
      profile:  { ...base.profile,  ...(parsed.profile  || {}) },
      goals:    { ...base.goals,    ...(parsed.goals    || {}) },
      settings: { ...base.settings, ...(parsed.settings || {}) },
      favouriteBrands: parsed.favouriteBrands || [],
      brandUsage: parsed.brandUsage || {},
      cachedBrands: parsed.cachedBrands || {},
      dailyGoals: parsed.dailyGoals && parsed.dailyGoals.length ? parsed.dailyGoals : base.dailyGoals,
      dailyChecks: parsed.dailyChecks || {},
      goalTimers: parsed.goalTimers || {},
    };
  } catch {
    return empty();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const todayISO = () => new Date().toISOString().slice(0,10);
export const isoDaysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate()-n);
  return d.toISOString().slice(0,10);
};

export const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id_' + Math.random().toString(36).slice(2);

// --- Energy & macro maths ---
//
// BMR via Mifflin-St Jeor (1990). Validated as the most accurate predictive
// equation for healthy adults — used by ADA, AND, and the BDA over Harris-
// Benedict. Female form: 10·W + 6.25·H − 5·A − 161.
export function bmr(profile) {
  const { weightKg, heightCm, age } = profile;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
}

// TDEE = BMR × physical activity level (FAO/WHO PAL coefficients).
export function tdee(profile) {
  return Math.round(bmr(profile) * (profile.activity || 1.45));
}

// Lactation extra. AAP/NHMRC: ~450–500 kcal/day in first 6 months,
// ~400 kcal thereafter. We use 400 to align with conservative postpartum.
export function lactationKcal(profile) {
  return profile.breastfeeding ? 400 : 0;
}

// Deficit derived from desired rate of weight loss (1 kg fat ≈ 7700 kcal).
// Capped by a safety floor in dailyCalorieTarget().
export function weightLossDeficit(profile, goals) {
  if (profile.weightKg <= goals.weightKg) return 0;
  const rate = Math.max(0, Math.min(0.6, goals.weightLossKgPerWeek || 0.35));
  return Math.round((rate * 7700) / 7);
}

// Daily energy target — TDEE + lactation − deficit, with a safety floor.
export function dailyCalorieTarget(profile, goals) {
  const total = tdee(profile) + lactationKcal(profile) - weightLossDeficit(profile, goals);
  // Safety floor: 1500 kcal non-lactating, 1800 kcal lactating
  const floor = profile.breastfeeding ? 1800 : 1500;
  return Math.max(floor, total);
}

// Macro targets in grams. The 'hba1c' strategy biases toward higher protein
// and moderate carbs (≤45% kcal) for blood-glucose stability — supported by
// evidence in postpartum/insulin-resistance literature (e.g. Diabetes Care
// guidelines on lower-glycaemic load patterns). 'balanced' follows the
// Australian Dietary Guidelines split.
export function macroTargets(profile, goals) {
  const kcal = dailyCalorieTarget(profile, goals);
  const w = profile.weightKg;
  if (goals.macroStrategy === 'hba1c') {
    // Protein: 1.8 g/kg (preserves lean mass + satiety + BG stability)
    // Fat:     0.9 g/kg minimum, balance from remaining kcal
    // Carbs:   the rest, capped so it stays ≤ 45% kcal
    const protein = Math.round(Math.min(2.0, 1.8) * w);
    let fat = Math.round(0.9 * w);
    let carbsKcal = kcal - protein * 4 - fat * 9;
    let carbs = Math.max(80, Math.round(carbsKcal / 4));
    // Cap carbs at 45% kcal; redistribute extra to fat
    const carbCap = Math.round((kcal * 0.45) / 4);
    if (carbs > carbCap) {
      const overflow = (carbs - carbCap) * 4;
      carbs = carbCap;
      fat += Math.round(overflow / 9);
    }
    return {
      kcal,
      protein,
      carbs,
      fat,
      fiber: goals.fiberG || 30,
      sugar: goals.sugarG || 25,
      strategy: 'hba1c',
    };
  }
  // Balanced (AGTHE-aligned): P 20% / C 50% / F 30%
  return {
    kcal,
    protein: Math.round((kcal * 0.20) / 4),
    carbs:   Math.round((kcal * 0.50) / 4),
    fat:     Math.round((kcal * 0.30) / 9),
    fiber:   goals.fiberG || 30,
    sugar:   goals.sugarG || 25,
    strategy: 'balanced',
  };
}
