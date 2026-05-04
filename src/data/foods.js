// Food entry schema:
// {
//   id: string, name: string, aliases: [string],
//   group: 'protein'|'grain'|'veg'|'fruit'|'dairy'|'fat'|'legume'|'beverage'|'snack'|'condiment'|'mixed',
//   unit: 'g'|'ml'|'piece', per: number,         // reference quantity (e.g. 100g, 1 piece)
//   kcal, protein, carbs, fat, fiber             // nutrients per `per` `unit`
//   pieceGrams?: number                          // grams for 'piece' items, used when normalising
// }
//
// All numbers per 100g unless unit='piece' (then per single item).
// Sources: USDA / AUSNUT averages, rounded.

import { foodsCore } from './foods.core.js';
import { foodsExtra } from './foods.extra.js';
import { foodsAU } from './foods.au.js';

export const FOODS = [...foodsCore, ...foodsExtra, ...foodsAU];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

const INDEX = FOODS.map((f) => ({
  food: f,
  keys: [f.name, ...(f.aliases || [])].map(norm),
}));

// Custom foods the user has added at runtime — registered from App.jsx
// whenever state.customFoods changes. The main INDEX stays static; we
// merge USER_INDEX in front so user foods win identically-named hits.
let USER_INDEX = [];
export function registerCustomFoods(list) {
  USER_INDEX = (list || []).map((f) => ({
    food: f,
    keys: [f.name, ...(f.aliases || [])].map(norm),
  }));
}
function indexes() { return [...USER_INDEX, ...INDEX]; }

export function findFood(query) {
  const q = norm(query);
  if (!q) return null;
  const idx = indexes();
  // exact alias hit
  for (const { food, keys } of idx) if (keys.includes(q)) return food;
  // starts-with
  for (const { food, keys } of idx) if (keys.some((k) => k.startsWith(q))) return food;
  // contains all words
  const words = q.split(/\s+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const { food, keys } of idx) {
    for (const k of keys) {
      const hits = words.filter((w) => k.includes(w)).length;
      const score = hits / words.length - Math.abs(k.length - q.length) / 200;
      if (hits === words.length && score > bestScore) { best = food; bestScore = score; }
    }
  }
  return best;
}

export function searchFoods(query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const { food, keys } of indexes()) {
    let s = 0;
    for (const k of keys) {
      if (k === q) s = Math.max(s, 100);
      else if (k.startsWith(q)) s = Math.max(s, 80);
      else if (k.includes(q)) s = Math.max(s, 50);
    }
    if (s > 0) scored.push({ food, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.food);
}

// Compute kcal/macros for an arbitrary amount.
// amount is interpreted in `unit` (g, ml, or piece).
export function nutrientsFor(food, amount, unit) {
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, freeSugars: 0 };
  let factor;
  if (food.unit === 'piece') {
    if (unit === 'piece') factor = amount / food.per;
    else if (unit === 'g' && food.pieceGrams) factor = amount / (food.per * food.pieceGrams);
    else factor = amount / food.per;
  } else {
    // g or ml base
    factor = amount / food.per;
  }
  const m = (k) => Math.round(((food[k] || 0) * factor) * 10) / 10;
  const carbs = m('carbs');
  const sugars = estimateSugars(food, carbs);
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    protein: m('protein'),
    carbs,
    fat: m('fat'),
    fiber: m('fiber'),
    sugars,
    freeSugars: Math.round(sugars * freeSugarFraction(food) * 10) / 10,
    group: food.group,
  };
}

// Sugar estimator for the generic database (which lacks per-item sugar data).
// Returns grams of sugar derived from carbs by food group. Brand entries
// override this with the exact NIP value.
const SUGAR_RATIO = {
  fruit: 0.80, beverage: 0.85, condiment: 0.65, snack: 0.45, dairy: 0.55,
  mixed: 0.15, veg: 0.30, grain: 0.05, legume: 0.10, protein: 0, fat: 0,
};
export function estimateSugars(food, carbsG) {
  if (food.sugars != null) return Math.round(food.sugars * 10) / 10;
  const r = SUGAR_RATIO[food.group] ?? 0.10;
  return Math.round((carbsG || 0) * r * 10) / 10;
}

// Free-sugar fraction = portion of total sugars that are ADDED or
// otherwise "free" per WHO definition (added during processing, plus
// sugars naturally present in honey, syrups, fruit juices, fruit juice
// concentrates, dried fruit). Whole fruit, plain dairy, and vegetables
// contribute "intrinsic" sugars that are NOT free.
//
// 0 = fully intrinsic; 1 = fully free.
//
// The 25 g/day cap defaulted in goals applies to FREE sugars only — this
// helper is what makes the Sugar ring a meaningful target.
const FREE_SUGAR_OVERRIDES = {
  // Fruit but processed → free
  orange_juice: 1, apple_juice: 1,
  raisins: 1, sultanas: 1, dried_apricot: 1, dried_cranberries: 1,
  dates: 0.7,
  // Plain dairy → intrinsic lactose only
  yogurt_natural: 0, yogurt_greek: 0, milk_full: 0, milk_skim: 0,
  milk_almond: 0, cottage_cheese: 0,
  // Sweetened plant milks
  milk_oat: 0.4,  milk_soy: 0.3,
  // Condiments / syrups → free
  honey: 1, maple_syrup: 1, jam: 1, sugar: 1, tomato_sauce: 0.8,
  // Beverages
  kombucha: 0.7, smoothie_berry: 0.4,
};
export function freeSugarFraction(food) {
  if (!food) return 1;
  if (food.freeSugarFraction != null) return food.freeSugarFraction; // brand foods carry this directly
  if (food.id && FREE_SUGAR_OVERRIDES[food.id] != null) return FREE_SUGAR_OVERRIDES[food.id];
  switch (food.group) {
    case 'fruit':     return 0;     // whole fruit
    case 'veg':       return 0;
    case 'legume':    return 0;
    case 'protein':   return 0;
    case 'fat':       return 0;
    case 'dairy':     return 0.2;   // most plain; sweetened items override
    case 'grain':     return 0.4;   // sugars in grains are partly added
    case 'snack':     return 1;
    case 'beverage':  return 1;
    case 'condiment': return 1;
    case 'mixed':     return 0.5;
    default:          return 1;
  }
}
