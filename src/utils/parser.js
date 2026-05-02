// Parses free-text / voice transcripts into structured food or exercise entries.
import { FOODS, findFood, nutrientsFor, estimateSugars } from '../data/foods.js';
import { EXERCISES, findExercise, kcalBurned } from '../data/exercises.js';
import { BRAND_FOODS, searchBrandFoods, inferGramsFromVoice, calcMacros } from './brandFoods.js';

// Brand aliases that contain " and " or " & " — these get collapsed to a
// single token before the conjunction-based splitter runs, otherwise
// "250ml up and go" would split into "250ml up" and "go".
const PROTECTED_PHRASES = (() => {
  const set = new Set();
  for (const f of BRAND_FOODS) {
    for (const a of (f.aliases || [])) {
      const lc = a.toLowerCase();
      if (/\s(and|&)\s/.test(lc) || /[&]/.test(lc)) set.add(lc);
    }
  }
  return [...set];
})();
function protectBrandPhrases(t) {
  let out = ' ' + t + ' ';
  for (const p of PROTECTED_PHRASES) {
    // Collapse spaces but keep "and" — alias 'up and go' becomes 'upandgo',
    // which matches the dataset's no-space alias variant.
    const protectedToken = p.replace(/\s*&\s*/g, 'and').replace(/\s+/g, '');
    const re = new RegExp('\\s' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s', 'gi');
    out = out.replace(re, ' ' + protectedToken + ' ');
  }
  return out.trim();
}

const NUM_WORDS = {
  a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7,
  eight:8, nine:9, ten:10, eleven:11, twelve:12, half:0.5, quarter:0.25,
  'a half':0.5, 'a quarter':0.25,
};

const FRACTIONS = { '½':0.5, '¼':0.25, '¾':0.75, '⅓':1/3, '⅔':2/3 };

function parseNumber(token) {
  if (token == null) return null;
  if (FRACTIONS[token] != null) return FRACTIONS[token];
  if (NUM_WORDS[token] != null) return NUM_WORDS[token];
  const n = parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

// Unit aliases → canonical
const UNITS = {
  g: 'g', gram: 'g', grams: 'g', gs: 'g',
  kg: 'g', kilogram: 'g', kilograms: 'g',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'ml', litre: 'ml', litres: 'ml', liter: 'ml', liters: 'ml',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  serve: 'serve', serves: 'serve', serving: 'serve', servings: 'serve',
  scoop: 'scoop', scoops: 'scoop',
  handful: 'handful', handfuls: 'handful',
  bowl: 'bowl', bowls: 'bowl',
  glass: 'glass', glasses: 'glass',
  bottle: 'bottle', bottles: 'bottle',
  can: 'can', cans: 'can',
  small: 'small', medium: 'medium', large: 'large',
  min: 'min', mins: 'min', minute: 'min', minutes: 'min',
  hr: 'hr', hrs: 'hr', hour: 'hr', hours: 'hr',
  km: 'km', kms: 'km', kilometre: 'km', kilometres: 'km', kilometer: 'km', kilometers: 'km',
};

// Volume conversions to ml (water-equivalent baseline; for solids we treat cup ≈ 240ml then map to grams).
const VOLUME_ML = { cup: 240, tbsp: 15, tsp: 5, glass: 250, bottle: 600 };

// Approximate mass (g) for unit×food when food has unit='g'.
// Uses food group hints. Conservative defaults.
function gramsForLooseUnit(food, unit, count) {
  if (food.unit === 'piece') return null; // piece foods handled separately
  if (UNITS[unit] === 'g') return count;
  if (UNITS[unit] === 'ml') return count;
  const u = UNITS[unit];
  const cup_g = (() => {
    switch (food.group) {
      case 'grain':   return 180;       // cooked rice/pasta
      case 'veg':     return 150;
      case 'fruit':   return 150;
      case 'legume':  return 175;
      case 'dairy':   return 245;       // yogurt/milk-ish
      case 'snack':   return 30;
      case 'fat':     return 140;
      default:        return 200;
    }
  })();
  if (u === 'cup')   return count * cup_g;
  if (u === 'tbsp')  return count * (cup_g / 16);
  if (u === 'tsp')   return count * (cup_g / 48);
  if (u === 'handful') return count * 30;
  if (u === 'scoop')   return count * 30;
  if (u === 'serve')   return count * 100;
  if (u === 'bowl')    return count * 250;
  if (u === 'glass')   return count * 240;
  if (u === 'bottle')  return count * 600;
  if (u === 'can')     return count * 400;
  if (u === 'small')   return count * 80;
  if (u === 'medium')  return count * 150;
  if (u === 'large')   return count * 220;
  if (u === 'slice') {
    if (food.id === 'bread_sourdough' || food.id === 'bread_wholegrain' || food.id === 'bread_white') return count * 40;
    return count * 30;
  }
  return null;
}

// Splits a transcript into "items" using common conjunctions.
export function splitItems(text) {
  if (!text) return [];
  let t = ` ${text.toLowerCase().trim()} `;
  // Protect known brand phrases that contain "and" so the splitter doesn't
  // chop "up and go" into "up" + "go".
  t = ' ' + protectBrandPhrases(t.trim()) + ' ';
  // Map digits with fractions like "1/2"
  t = t.replace(/(\d+)\s*\/\s*2/g, (_, n) => ` ${parseInt(n)/2} `);
  t = t.replace(/(\d+)\s*\/\s*4/g, (_, n) => ` ${parseInt(n)/4} `);
  // Normalise punctuation
  t = t.replace(/[,;\.]/g, ' and ');
  t = t.replace(/\s+plus\s+/g, ' and ');
  t = t.replace(/\s+with\s+/g, ' and ');
  t = t.replace(/\s+then\s+/g, ' and ');
  // Split on "and"
  return t.split(/\s+and\s+/).map((s) => s.trim()).filter(Boolean);
}

// Try to parse a single item like "two slices of sourdough toast" or "150g chicken".
export function parseFoodItem(raw) {
  const phrase = raw.replace(/\s+of\s+/, ' ').trim();
  const tokens = phrase.split(/\s+/);
  if (!tokens.length) return null;

  // 1. find a number (possibly first token) and optional unit
  let count = 1, unit = null, i = 0;

  // patterns: "150g chicken", "2 slices toast", "a banana", "half a banana"
  const num = parseNumber(tokens[0]);
  if (num != null) { count = num; i = 1; }

  // gram-attached number e.g. "150g", "200ml"
  if (i === 0) {
    const m = tokens[0].match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)$/i);
    if (m) { count = parseFloat(m[1]); unit = m[2].toLowerCase(); if (unit === 'kg') count *= 1000; if (unit === 'l') count *= 1000; unit = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit; i = 1; }
  } else {
    const m = tokens[0].match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)$/i);
    if (m) { count = parseFloat(m[1]); unit = m[2].toLowerCase(); if (unit === 'kg') count *= 1000; if (unit === 'l') count *= 1000; unit = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit; i = 1; }
  }

  if (!unit && tokens[i] && UNITS[tokens[i]]) {
    unit = UNITS[tokens[i]];
    i += 1;
  }

  // remainder is the food name
  const foodPhrase = tokens.slice(i).join(' ').replace(/^of\s+/, '').trim();
  if (!foodPhrase) return null;

  // ---- Brand-aware path ----
  // Try the brand database first. If the top match is strong (the query
  // contains the brand name or a multi-word product alias), interpret the
  // quantity using the serving label and return a brand entry.
  const brandHit = matchBrandFood(foodPhrase);
  if (brandHit) {
    const grams = inferGramsFromVoice(brandHit, count, unit);
    if (grams && grams > 0) {
      const m = calcMacros(brandHit, grams, brandHit.serving.unit);
      const label = brandHit.variant
        ? `${brandHit.brand} ${brandHit.name} (${brandHit.variant})`
        : `${brandHit.brand} ${brandHit.name}`;
      return {
        foodId: brandHit.id,
        brandFoodId: brandHit.id,
        group: brandHit.group,
        name: label,
        amount: Math.round(grams * 10) / 10,
        unit: brandHit.serving.unit,
        kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
        fiber: m.fiber, sugars: m.sugars, freeSugars: m.freeSugars, satFat: m.satFat, sodium: m.sodium,
        raw,
      };
    }
  }

  const food = findFood(foodPhrase) || findFoodWithStrippedPrefix(foodPhrase);
  if (!food) return { unknown: true, query: foodPhrase, raw };

  // resolve quantity → (amount, unit) matching the food's reference unit
  let amount, useUnit;
  if (food.unit === 'piece') {
    if (!unit || unit === 'piece' || unit === 'serve' || unit === 'slice') {
      amount = count; useUnit = 'piece';
    } else if (unit === 'g' || unit === 'ml') {
      amount = count; useUnit = unit;
    } else {
      amount = count; useUnit = 'piece';
    }
  } else {
    // food expressed per 100 g/ml
    if (!unit) {
      if (food.pieceGrams) {
        // bare-count of a piece-eligible food — "6 blackberries" with
        // pieceGrams=5 -> 30 g.
        amount = food.pieceGrams * count;
      } else {
        // generic bare number → assume "1 serve" of ~100 g/ml.
        amount = food.per * count;
      }
      useUnit = food.unit;
    } else if (unit === 'g' || unit === 'ml') {
      amount = count; useUnit = unit;
    } else if ((unit === 'piece' || unit === 'pieces') && food.pieceGrams) {
      // explicit "6 pieces" of a piece-eligible food.
      amount = food.pieceGrams * count;
      useUnit = food.unit;
    } else {
      const g = gramsForLooseUnit(food, unit, count);
      amount = g != null ? g : food.per * count;
      useUnit = food.unit; // grams or ml
    }
  }

  const macros = nutrientsFor(food, amount, useUnit);
  return {
    foodId: food.id,
    name: food.name,
    amount: Math.round(amount * 10) / 10,
    unit: useUnit,
    ...macros,
    raw,
  };
}

export function parseFoodTranscript(text) {
  const items = splitItems(text).map(parseFoodItem).filter(Boolean);
  return items;
}

// When neither the curated brand DB nor the generic DB matches the full
// phrase, try dropping leading words and retrying — this handles brand-
// prefixed queries where the brand isn't in our curated list, e.g.
// "farmers union greek yoghurt" -> "greek yoghurt" matches.
function findFoodWithStrippedPrefix(phrase) {
  const words = phrase.split(/\s+/).filter(Boolean);
  for (let n = 1; n < words.length; n++) {
    const suffix = words.slice(n).join(' ');
    if (suffix.length < 3) break;
    const f = findFood(suffix);
    if (f) return f;
  }
  return null;
}

// Brand match returns a brand food only when we're confident the user meant
// a branded product. Two paths:
//   1. The query contains a recognisable brand name (Chobani, Sanitarium,
//      Helga's, etc.) — among that brand's products, pick the one whose
//      name/variant/aliases share the most extra words with the query.
//   2. No brand name, but a long unambiguous alias matches (e.g. "vegemite",
//      "weetbix", "tim tam") — return that product directly.
// Generic words like "milk" or "yogurt" never trigger a brand match.
function matchBrandFood(phrase) {
  if (!phrase) return null;
  const q = phrase.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (!q) return null;
  const qFlat = q.replace(/\s+/g, '');
  const tokens = q.split(/\s+/).filter(Boolean);

  // Path 1: brand name appears in the query.
  const brandMatches = [];
  for (const f of BRAND_FOODS) {
    const b = (f.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (b.length >= 4 && qFlat.includes(b)) brandMatches.push(f);
  }
  if (brandMatches.length === 1) return brandMatches[0];
  if (brandMatches.length > 1) {
    // Disambiguate by counting query tokens that hit name/variant/alias text.
    let best = brandMatches[0]; let bestScore = -1;
    for (const f of brandMatches) {
      const text = [f.name, f.variant, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase();
      const score = tokens.filter((t) => t.length >= 3 && text.includes(t)).length;
      if (score > bestScore) { best = f; bestScore = score; }
    }
    return best;
  }

  // Path 2: long unambiguous alias hit.
  for (const f of BRAND_FOODS) {
    for (const a of (f.aliases || [])) {
      const an = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (an.length >= 6 && qFlat.includes(an)) return f;
    }
  }
  return null;
}

// Exercise parser: "ran 5km in 30 minutes" / "walked with the pram for 45 min"
export function parseExerciseTranscript(text, weightKg = 70) {
  if (!text) return null;
  const t = ` ${text.toLowerCase()} `;

  // Pull out duration
  let minutes = null;
  const minMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/);
  const hrMatch  = t.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours)\b/);
  const hMinMatch = t.match(/(\d+)\s*h(?:r)?\s*(\d+)\s*m/);
  if (hMinMatch) minutes = parseInt(hMinMatch[1])*60 + parseInt(hMinMatch[2]);
  else if (hrMatch) minutes = parseFloat(hrMatch[1]) * 60;
  else if (minMatch) minutes = parseFloat(minMatch[1]);

  // Pull out distance
  let km = null;
  const kmMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:km|kms|kilometre|kilometres|kilometer|kilometers)\b/);
  if (kmMatch) km = parseFloat(kmMatch[1]);

  // strip numeric phrases to leave activity name
  let activityPhrase = t
    .replace(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours|km|kms|kilometre|kilometres|kilometer|kilometers)\b/g, ' ')
    .replace(/\b(?:for|in|of|the|a|an|did|i|we|today|with)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

  let exercise = findExercise(activityPhrase);

  // fallback: keyword sniff
  if (!exercise) {
    if (/\brun\b|\brunning\b|\bran\b|\bjog/.test(t)) exercise = findExercise('run');
    else if (/\bwalk/.test(t) && /\bpram\b|\bstroller\b|\bbaby\b/.test(t)) exercise = findExercise('walking with pram');
    else if (/\bwalk/.test(t)) exercise = findExercise('walking');
    else if (/\bcycle\b|\bbike\b|\bcycling\b|\briding\b/.test(t)) exercise = findExercise('cycling');
    else if (/\byoga\b/.test(t)) exercise = findExercise('yoga');
    else if (/\bpilates\b/.test(t)) exercise = findExercise('pilates');
    else if (/\bswim/.test(t)) exercise = findExercise('swim');
  }

  if (!exercise) return { unknown: true, raw: text };

  // If we have km but no minutes, estimate via pace
  if (!minutes && km) {
    const paceMap = {
      walk_easy: 12, walk_brisk: 10, walk_pram: 13, run_steady: 5.5,
      jog_easy: 6.5, run_tempo: 5, run_fast: 4.5, pram_jog: 7,
      cycle_leisure: 3.3, cycle_moderate: 2.7, cycle_vigorous: 2.1,
    };
    const minPerKm = paceMap[exercise.id] ?? 6;
    minutes = km * minPerKm;
  }
  if (!minutes) minutes = 30;

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    minutes: Math.round(minutes),
    km: km ? Math.round(km * 10) / 10 : null,
    kcal: kcalBurned(exercise, minutes, weightKg),
    raw: text,
  };
}

// Heuristic: is this transcript more food-like or exercise-like?
export function classifyTranscript(text) {
  if (!text) return 'food';
  const t = text.toLowerCase();
  const exHints = ['ran','run','running','jog','walk','walked','cycle','cycled','bike','swim','pilates','yoga','workout','gym','class','minutes','min ','hour','hr ','km'];
  const foodHints = ['ate','had','cup','slice','grams','g ','ml ','tbsp','tsp','breakfast','lunch','dinner','snack','coffee','smoothie'];
  let ex = exHints.filter((h) => t.includes(h)).length;
  let fd = foodHints.filter((h) => t.includes(h)).length;
  return ex > fd ? 'exercise' : 'food';
}
