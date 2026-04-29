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

export function findFood(query) {
  const q = norm(query);
  if (!q) return null;
  // exact alias hit
  for (const { food, keys } of INDEX) if (keys.includes(q)) return food;
  // starts-with
  for (const { food, keys } of INDEX) if (keys.some((k) => k.startsWith(q))) return food;
  // contains all words
  const words = q.split(/\s+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const { food, keys } of INDEX) {
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
  for (const { food, keys } of INDEX) {
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
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
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
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    protein: m('protein'),
    carbs: m('carbs'),
    fat: m('fat'),
    fiber: m('fiber'),
  };
}
