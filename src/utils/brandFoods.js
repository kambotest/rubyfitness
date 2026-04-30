// Brand-food utilities: search, serving calculator, and QA/QC validation.
//
// QA/QC pipeline (two layers):
//   1. Curation-time: each entry in data/brandFoods.au.js is sourced from the
//      manufacturer's NIP and cross-checked against the Woolworths product
//      page where possible. The qa.cross array records which sources were
//      reconciled and qa.confidence captures the curator's judgement.
//   2. Runtime: validateBrandFood() re-runs an Atwater consistency check
//      (4·protein + 4·carbs + 9·fat ≈ kcal) and verifies required fields.
//      Any item that fails surfaces a "Data check" warning in the UI so the
//      user is never silently shown bad numbers.

import { BRAND_FOODS_AU } from '../data/brandFoods.au.js';

export const BRAND_FOODS = [...BRAND_FOODS_AU];

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

const INDEX = BRAND_FOODS.map((f) => ({
  food: f,
  keys: [
    f.brand,
    f.name,
    `${f.brand} ${f.name}`,
    f.variant ? `${f.brand} ${f.name} ${f.variant}` : null,
    ...(f.aliases || []),
  ].filter(Boolean).map(norm),
}));

// Search ranking: exact > starts-with > token coverage. Brand-prefixed
// queries like "chobani vanilla" hit the combined `brand name` keys first.
export function searchBrandFoods(query, limit = 8) {
  const q = norm(query);
  if (!q || q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const { food, keys } of INDEX) {
    let s = 0;
    for (const k of keys) {
      if (k === q) s = Math.max(s, 100);
      else if (k.startsWith(q)) s = Math.max(s, 80);
      else if (k.includes(q)) s = Math.max(s, 60);
      else {
        const hits = words.filter((w) => k.includes(w)).length;
        if (hits === words.length) s = Math.max(s, 40 + hits * 5);
      }
    }
    if (s > 0) scored.push({ food, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.food);
}

export function findBrandFoodById(id) {
  return BRAND_FOODS.find((f) => f.id === id) || null;
}

// ---- Serving calculator ----
// Returns macros for a given amount of a brand food.
// mode: 'g' | 'ml' | 'serving' | 'package'
export function calcMacros(food, amount, mode = 'serving') {
  if (!food || !Number.isFinite(amount) || amount <= 0) {
    return { grams: 0, kcal: 0, protein: 0, carbs: 0, sugars: 0, fat: 0, satFat: 0, fiber: 0, sodium: 0 };
  }
  let grams;
  if (mode === 'g' || mode === 'ml') grams = amount;
  else if (mode === 'serving') grams = amount * food.serving.size;
  else if (mode === 'package') grams = amount * food.package.size;
  else grams = amount;

  const f = grams / 100;
  const r1 = (n) => Math.round((n || 0) * f * 10) / 10;
  return {
    grams: Math.round(grams * 10) / 10,
    kcal: Math.round((food.per100.kcal || 0) * f),
    protein: r1(food.per100.protein),
    carbs: r1(food.per100.carbs),
    sugars: r1(food.per100.sugars),
    fat: r1(food.per100.fat),
    satFat: r1(food.per100.satFat),
    fiber: r1(food.per100.fiber),
    sodium: Math.round((food.per100.sodium || 0) * f),
  };
}

// ---- Runtime QA/QC ----
// Atwater check: for typical foods, 4·protein + 4·carbs + 9·fat ≈ kcal.
// We allow up to 12% slack for fibre/alcohol/rounding before flagging.
export function validateBrandFood(food) {
  const warnings = [];
  if (!food.per100) return { valid: false, warnings: ['Missing nutrition panel'] };
  const required = ['kcal', 'protein', 'carbs', 'fat'];
  const missing = required.filter((k) => food.per100[k] == null);
  if (missing.length) warnings.push(`Missing ${missing.join(', ')}`);

  const { kcal, protein = 0, carbs = 0, fat = 0 } = food.per100;
  if (kcal > 5) {
    const expected = 4 * protein + 4 * carbs + 9 * fat;
    const drift = Math.abs(expected - kcal) / Math.max(kcal, 1);
    if (drift > 0.12) {
      warnings.push(`Energy mismatch (${Math.round(drift * 100)}% off Atwater)`);
    }
  }
  if (!food.source?.url) warnings.push('No source URL recorded');
  if (!food.qa?.verifiedAt) warnings.push('Not yet verified');
  return { valid: warnings.length === 0, warnings };
}

// Convenience: get a runtime QA summary for the whole dataset (used in dev
// console / future Settings panel). Helps catch curation bugs.
export function brandFoodsAuditSummary() {
  let high = 0, medium = 0, low = 0, failing = 0;
  const issues = [];
  for (const f of BRAND_FOODS) {
    const v = validateBrandFood(f);
    if (!v.valid) { failing += 1; issues.push({ id: f.id, warnings: v.warnings }); }
    const c = f.qa?.confidence || 'low';
    if (c === 'high') high += 1; else if (c === 'medium') medium += 1; else low += 1;
  }
  return { total: BRAND_FOODS.length, high, medium, low, failing, issues };
}
