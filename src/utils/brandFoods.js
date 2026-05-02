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

// ---- Serving inference for voice/text input ----
// Reads the serving label (e.g. "2 biscuits (30 g)", "1 tub (170 g)") and
// extracts the unit hint and how many of those units make one declared
// serving. Lets the parser interpret "two weet-bix" as 2 biscuits (= 1
// serving = 30 g) rather than 2 servings.
const UNIT_WORDS = ['biscuit','biscuits','bar','bars','ball','balls','slice','slices','wrap','wraps','cracker','crackers','piece','pieces','cookie','cookies','tub','tubs','cup','cups','stick','sticks','egg','eggs','pouch','pouches','carton','cartons','can','cans','bottle','bottles','glass','glasses','bag','bags','sachet','sachets'];
const UNIT_RE = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s+(${UNIT_WORDS.join('|')})\\b`, 'i');
const ALL_UNITS_RE = new RegExp(`\\b(${UNIT_WORDS.join('|')})\\b`, 'i');

export function servingHint(food) {
  if (!food?.serving?.label) return null;
  const m = food.serving.label.match(UNIT_RE);
  if (m) return { unitsPerServing: parseFloat(m[1]), unit: m[2].toLowerCase().replace(/s$/,'') };
  // "1 tub (170 g)" without leading digit pattern (rare). Try second pass.
  const m2 = food.serving.label.match(ALL_UNITS_RE);
  if (m2) return { unitsPerServing: 1, unit: m2[1].toLowerCase().replace(/s$/,'') };
  return null;
}

// Translate a count + caller-provided unit into grams of this brand food.
// Used by the voice parser. Returns null if the request can't be honoured
// (e.g. user asked for kg of an item we only know per-serve).
//
// count   — numeric quantity ("two", "1.5", "100")
// unit    — 'g'|'ml'|'serving'|'piece'|<unit-word like 'biscuit'>|null
//   * If unit matches the food's serving-label unit word ('biscuit',
//     'tub', etc.) we treat count as that-many-of-that-thing and divide
//     by units-per-serving to land in grams.
//   * If unit is 'g'/'ml' we use it directly.
//   * If null, 'serving', or 'piece', we treat count as servings.
export function inferGramsFromVoice(food, count, unit) {
  if (!food || !Number.isFinite(count) || count <= 0) return null;
  const u = (unit || '').toLowerCase().replace(/s$/,'');
  if (u === 'g' || u === 'ml') return count;
  if (u === 'kg') return count * 1000;
  if (u === 'l')  return count * 1000;

  const hint = servingHint(food);
  // bare unit word like "biscuit" matches the serving's hint?
  if (hint && u && (u === hint.unit || isSameUnit(u, hint.unit))) {
    return (count / Math.max(1, hint.unitsPerServing)) * food.serving.size;
  }
  // "two weet-bix" with no unit word: if the food's serving is itself a
  // multi-piece (e.g. 2 biscuits per serve), assume the user means
  // count-of-the-piece, not count-of-servings.
  if (!u && hint && hint.unitsPerServing > 1) {
    return (count / hint.unitsPerServing) * food.serving.size;
  }
  // default: count = servings
  return count * food.serving.size;
}

function isSameUnit(a, b) {
  if (a === b) return true;
  // common synonyms
  const synSets = [
    ['biscuit','cookie'],
    ['piece','slice','wrap','cracker'],
    ['tub','pouch','carton','cup'],
    ['bottle','can','glass'],
  ];
  return synSets.some((g) => g.includes(a) && g.includes(b));
}

// ---- Serving calculator ----
// Returns macros for a given amount of a brand food.
// mode: 'g' | 'ml' | 'serving' | 'package'
export function calcMacros(food, amount, mode = 'serving') {
  if (!food || !Number.isFinite(amount) || amount <= 0) {
    return { grams: 0, kcal: 0, protein: 0, carbs: 0, sugars: 0, freeSugars: 0, fat: 0, satFat: 0, fiber: 0, sodium: 0 };
  }
  let grams;
  if (mode === 'g' || mode === 'ml') grams = amount;
  else if (mode === 'serving') grams = amount * food.serving.size;
  else if (mode === 'package') grams = amount * food.package.size;
  else grams = amount;

  const f = grams / 100;
  const r1 = (n) => Math.round((n || 0) * f * 10) / 10;
  const sugars = r1(food.per100.sugars);
  return {
    grams: Math.round(grams * 10) / 10,
    kcal: Math.round((food.per100.kcal || 0) * f),
    protein: r1(food.per100.protein),
    carbs: r1(food.per100.carbs),
    sugars,
    freeSugars: Math.round(sugars * brandFreeSugarFraction(food) * 10) / 10,
    fat: r1(food.per100.fat),
    satFat: r1(food.per100.satFat),
    fiber: r1(food.per100.fiber),
    sodium: Math.round((food.per100.sodium || 0) * f),
  };
}

// Per-product free-sugar fraction. Most curated entries are tagged
// directly in data/brandFoods.au.js; we fall back here for items
// that haven't been tagged yet (e.g. proxy or OFF results).
const BRAND_FREE_SUGAR_DEFAULTS = {
  // Plain dairy / cheese — intrinsic only
  farmers_union_greek_natural: 0,
  chobani_greek_plain: 0,
  jalna_greek_natural: 0,
  pauls_smarter_white_milk: 0,
  mainland_tasty_cheese: 0,
  bega_stringers: 0,
  // Sweetened dairy / drinks
  chobani_fit_vanilla: 1,
  yopro_vanilla: 1,
  sanitarium_upngo_choc_ice: 1,
  vitasoy_soy_milky_lite: 0.4,
  sogood_almond_unsweetened: 0,
  farmers_union_iced_coffee: 1,
  coca_cola_classic: 1,
  coca_cola_no_sugar: 0,           // negligible sugars anyway
  // Bread / cereal
  sanitarium_weetbix_original: 0.5,
  helgas_wholemeal_mixed_grain: 0.6,
  tiptop_sunblest_white: 1,
  mountain_bread_wholemeal_wraps: 0.4,
  uncle_tobys_quick_oats: 0,
  carmans_original_muesli: 0.6,
  // Snacks (essentially all free)
  arnotts_tim_tam_original: 1,
  arnotts_salada_original: 0.8,
  cobs_lightly_salted_popcorn: 0,
  bounce_almond_protein_ball: 1,
  lindt_excellence_70: 1,
  // Spreads / pantry
  vegemite: 0,
  mayver_smooth_peanut_butter: 0,
  anchor_butter: 0,
  // Fresh
  woolworths_australian_eggs_large: 0,
  sunrice_jasmine_microwave: 0,
};
function brandFreeSugarFraction(food) {
  if (!food) return 1;
  if (food.freeSugarFraction != null) return food.freeSugarFraction;
  if (food.id && BRAND_FREE_SUGAR_DEFAULTS[food.id] != null) return BRAND_FREE_SUGAR_DEFAULTS[food.id];
  // Group-based fallback for live-lookup items.
  switch (food.group) {
    case 'dairy':     return 0.4;
    case 'fruit':     return 0;
    case 'veg':       return 0;
    case 'protein':   return 0;
    case 'fat':       return 0;
    case 'snack':     return 1;
    case 'beverage':  return 1;
    case 'condiment': return 1;
    case 'mixed':     return 0.6;
    case 'grain':     return 0.5;
    case 'legume':    return 0;
    default:          return 1;
  }
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
