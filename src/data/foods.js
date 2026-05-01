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
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0 };
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
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    protein: m('protein'),
    carbs,
    fat: m('fat'),
    fiber: m('fiber'),
    sugars: estimateSugars(food, carbs),
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
