// Unified product lookup. Tries sources in order of trustworthiness:
//   1. Curated brand list (instant, offline, manually QA'd).
//   2. Server proxy (the deployer's own scraper of the Woolworths /
//      manufacturer NIP — see /server-proxy reference).
//   3. Open Food Facts (community-maintained, used as a final fallback
//      because data quality is uneven).
//
// All sources return objects shaped like data/brandFoods.au.js entries so
// the rest of the app — ServingCalculator, search, voice parser — needs no
// special-casing. Items from the proxy or OFF carry qa.confidence
// 'medium' or 'low' respectively, plus a fresh source URL.
//
// Network failures degrade silently: lookup falls through to the next
// source and returns null only if everything misses. The UI shows a
// gentle "couldn't find that" message in that case.

import { BRAND_FOODS, findBrandFoodById, searchBrandFoods } from './brandFoods.js';

const OFF_BARCODE = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_SEARCH  = 'https://world.openfoodfacts.org/cgi/search.pl';

export async function lookupByBarcode(barcode, settings = {}) {
  const code = (barcode || '').trim();
  if (!code) return null;

  // 1. curated
  const curated = BRAND_FOODS.find((f) => f.barcode === code);
  if (curated) return { food: curated, source: 'curated' };

  // 2. proxy (Woolworths / manufacturer)
  if (settings.proxyEndpoint) {
    try {
      const r = await fetch(
        `${trimSlash(settings.proxyEndpoint)}/lookup?barcode=${encodeURIComponent(code)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (r.ok) {
        const data = await r.json();
        if (data?.found && data.food) return { food: normaliseFromProxy(data.food, code), source: data.source || 'proxy' };
      }
    } catch { /* fall through */ }
  }

  // 3. Open Food Facts
  if (settings.enableOFF !== false) {
    try {
      const r = await fetch(`${OFF_BARCODE}${encodeURIComponent(code)}.json`);
      const data = await r.json();
      if (data?.status === 1 && data.product) {
        return { food: normaliseFromOFF(data.product, code), source: 'openfoodfacts' };
      }
    } catch { /* fall through */ }
  }

  return null;
}

export async function lookupByText(query, settings = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const results = [];

  // 1. curated (instant)
  const curated = searchBrandFoods(q, 6);
  curated.forEach((f) => results.push({ food: f, source: 'curated' }));
  if (results.length >= 6) return results;

  // 2. proxy
  if (settings.proxyEndpoint) {
    try {
      const r = await fetch(
        `${trimSlash(settings.proxyEndpoint)}/search?q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (r.ok) {
        const data = await r.json();
        for (const item of (data?.results || []).slice(0, 6 - results.length)) {
          results.push({ food: normaliseFromProxy(item), source: data.source || 'proxy' });
        }
      }
    } catch { /* fall through */ }
  }
  if (results.length >= 6) return results;

  // 3. Open Food Facts (only if we still have room)
  if (settings.enableOFF !== false) {
    try {
      const url = `${OFF_SEARCH}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&countries_tags_en=australia`;
      const r = await fetch(url);
      const data = await r.json();
      for (const p of (data?.products || []).slice(0, 8 - results.length)) {
        const f = normaliseFromOFF(p, p.code);
        if (f) results.push({ food: f, source: 'openfoodfacts' });
      }
    } catch { /* fall through */ }
  }

  return results;
}

// ---- Normalisers ----

function normaliseFromProxy(raw, barcode) {
  // Proxy is expected to already speak our schema. Just stamp QA fields.
  return {
    ...raw,
    barcode: raw.barcode || barcode,
    qa: {
      verifiedAt: raw.qa?.verifiedAt || isoToday(),
      confidence: raw.qa?.confidence || 'medium',
      cross: raw.qa?.cross || ['proxy'],
      ...(raw.qa || {}),
    },
  };
}

function normaliseFromOFF(p, code) {
  if (!p) return null;
  const n = p.nutriments || {};
  const energyKcal100 =
    num(n['energy-kcal_100g']) ??
    (num(n.energy_100g) != null ? num(n.energy_100g) / 4.184 : null);
  if (energyKcal100 == null) return null; // no usable nutrition

  const isLiquid = /(milk|drink|beverage|water|juice|soda|cola)/i.test(p.categories_tags?.join(' ') || '');
  const unit = isLiquid ? 'ml' : 'g';
  const servingSize = parseQuantity(p.serving_size) || 100;
  const packageSize = parseQuantity(p.quantity) || servingSize;

  return {
    id: 'off_' + (code || p.code || cryptoId()),
    barcode: code || p.code,
    brand: (p.brands || '').split(',')[0].trim() || 'Unbranded',
    name: p.product_name || p.generic_name || 'Unknown product',
    variant: '',
    serving: { size: servingSize, unit, label: p.serving_size || `${servingSize} ${unit}` },
    package: { size: packageSize, unit },
    per100: {
      kcal:    Math.round(energyKcal100),
      protein: round1(n.proteins_100g),
      carbs:   round1(n.carbohydrates_100g),
      sugars:  round1(n.sugars_100g),
      fat:     round1(n.fat_100g),
      satFat:  round1(n['saturated-fat_100g']),
      fiber:   round1(n.fiber_100g),
      sodium:  Math.round((num(n.sodium_100g) || (num(n.salt_100g) || 0) * 0.4) * 1000), // g→mg
    },
    group: groupFromOFF(p),
    aliases: [],
    source: {
      primary: 'openfoodfacts',
      url: `https://world.openfoodfacts.org/product/${code || p.code}`,
    },
    qa: {
      verifiedAt: null,
      confidence: 'low',
      cross: ['openfoodfacts'],
      note: 'Community-maintained data — please verify against the pack.',
    },
  };
}

function groupFromOFF(p) {
  const tags = (p.categories_tags || []).join(' ').toLowerCase();
  if (/yogurt|yoghurt|milk|cheese|dairy/.test(tags)) return 'dairy';
  if (/bread|cereal|grain|rice|pasta|noodle|oat/.test(tags)) return 'grain';
  if (/meat|fish|seafood|poultry|egg|tofu|tempeh|legume/.test(tags)) return 'protein';
  if (/fruit/.test(tags)) return 'fruit';
  if (/vegetable/.test(tags)) return 'veg';
  if (/oil|butter|nut|seed|spread/.test(tags)) return 'fat';
  if (/snack|biscuit|chocolate|confection|chips|cake/.test(tags)) return 'snack';
  if (/beverage|drink|juice|water|soda/.test(tags)) return 'beverage';
  if (/sauce|condiment|jam|honey|syrup/.test(tags)) return 'condiment';
  return 'mixed';
}

const num = (x) => (typeof x === 'number' && !Number.isNaN(x)) ? x : (typeof x === 'string' && x !== '' ? parseFloat(x) : null);
const round1 = (x) => { const n = num(x); return n == null ? 0 : Math.round(n * 10) / 10; };
const trimSlash = (s) => s.replace(/\/+$/, '');
const isoToday = () => new Date().toISOString().slice(0, 10);
const cryptoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2));

function parseQuantity(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === 'kg' || u === 'l') v *= 1000;
  return v;
}
