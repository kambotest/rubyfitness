// Lightweight localStorage store. Single JSON blob keyed by date for entries.
const KEY = 'cradle:v1';

const empty = () => ({
  profile: {
    name: '',
    weightKg: 72,             // current weight
    heightCm: 165,
    age: 32,
    activity: 1.45,           // PAL — light activity (postpartum baseline)
    breastfeeding: true,      // adds ~450 kcal
  },
  goals: {
    weightKg: 65,             // pre-baby weight
    weeklyKm: 30,             // running goal
    proteinG: 110,            // ~1.5 g/kg of goal weight
    fiberG: 30,
    fruitVegServes: 5,
    targetDate: null,
  },
  weights: [],                // [{date, kg}]
  foodEntries: [],            // [{id,date,foodId,name,amount,unit,kcal,protein,carbs,fat,fiber,meal,raw}]
  exerciseEntries: [],        // [{id,date,exerciseId,name,minutes,km,kcal,raw}]
  recipes: [],                // [{id,name,servings,items,perServe:{kcal,protein,carbs,fat,fiber}}]
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed, profile: { ...empty().profile, ...(parsed.profile||{}) }, goals: { ...empty().goals, ...(parsed.goals||{}) } };
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

// BMR via Mifflin-St Jeor; daily calories = BMR * activity (+ breastfeeding kcal)
export function dailyCalorieTarget(profile, goals) {
  const { weightKg, heightCm, age, activity, breastfeeding } = profile;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161; // female
  let tdee = bmr * activity;
  if (breastfeeding) tdee += 400;
  // gentle deficit if goal is below current weight
  const deficit = profile.weightKg > goals.weightKg ? 350 : 0;
  return Math.max(1700, Math.round(tdee - deficit));
}
