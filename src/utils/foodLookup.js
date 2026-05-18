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

// ---------- Import a product from a pasted URL ----------
//
// Most supermarket product pages are JavaScript-rendered single-page
// apps where the Nutrition Information Panel sits behind a tab and
// isn't in the raw HTML. So:
//   - r.jina.ai is tried FIRST — it actually renders the page (runs
//     the JS) and returns clean text/markdown, so tab content that's
//     in the DOM gets captured.
//   - Static-HTML proxies are the fallback.
//   - For a recognised Woolworths product URL we additionally hit
//     their public product-detail API, which returns clean JSON.
//
// Extraction tries, in order, until one yields a usable panel:
//   1. JSON-LD Product → schema.org NutritionInformation.
//   2. Embedded app-state JSON — deep-searches every <script> JSON
//      blob for a nutrition object or an AU-format NIP string.
//   3. Heuristic plain-text scrape — finds each nutrient label and
//      takes the right-most number+unit (AU panels list per-serving
//      then per-100, so the last value is per-100).
//
// Returns { food, source:'url' } or { food:null, reason }.
export async function lookupByUrl(url) {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  // Build the fetch list. r.jina.ai first (renders JS).
  const sources = [
    () => `https://r.jina.ai/${u}`,
    () => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    () => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  // Woolworths: also try the product-detail API (clean JSON NIP).
  const woolApi = woolworthsApiUrl(u);
  if (woolApi) {
    sources.unshift(() => `https://api.allorigins.win/raw?url=${encodeURIComponent(woolApi)}`);
    sources.unshift(() => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(woolApi)}`);
  }

  let reachedButEmpty = false;
  for (const build of sources) {
    let text;
    try {
      const r = await fetch(build());
      if (!r.ok) continue;
      text = await r.text();
    } catch {
      continue;
    }
    if (!text || text.length < 80) continue;
    const food = extractFoodFromPage(text, u);
    if (food) return { food, source: 'url' };
    reachedButEmpty = true;
  }
  return reachedButEmpty ? { food: null, reason: 'no-nutrition' } : { food: null, reason: 'unreachable' };
}

function woolworthsApiUrl(url) {
  const m = url.match(/woolworths\.com\.au\/shop\/productdetails\/(\d+)/i);
  return m ? `https://www.woolworths.com.au/apis/ui/product/detail/${m[1]}` : null;
}

function extractFoodFromPage(text, url) {
  const fromJsonLd = extractNutritionJsonLd(text);
  const fromEmbedded = extractEmbeddedJson(text);
  const fromNip = extractNipHeuristic(text);
  // Merge: JSON-LD > embedded JSON > heuristic, field-by-field.
  const per100 = {};
  for (const k of ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satFat', 'fiber', 'sodium']) {
    const v = (fromJsonLd?.per100?.[k] != null) ? fromJsonLd.per100[k]
      : (fromEmbedded?.per100?.[k] != null) ? fromEmbedded.per100[k]
      : (fromNip?.per100?.[k] != null) ? fromNip.per100[k] : null;
    if (v != null) per100[k] = v;
  }
  // Need at least energy + one macro to be worth logging.
  if (per100.kcal == null || (per100.protein == null && per100.carbs == null && per100.fat == null)) {
    return null;
  }
  const name = fromJsonLd?.name || fromEmbedded?.name || extractPageTitle(text) || 'Imported product';
  const brand = fromJsonLd?.brand || fromEmbedded?.brand || hostBrand(url);
  const servingSize = fromJsonLd?.servingSize || fromEmbedded?.servingSize || fromNip?.servingSize || 100;
  const unit = fromNip?.liquid ? 'ml' : 'g';

  return {
    id: 'url_' + cryptoId(),
    barcode: null,
    brand,
    name,
    variant: '',
    serving: { size: servingSize, unit, label: `${servingSize} ${unit}` },
    package: { size: servingSize, unit },
    per100: {
      kcal: per100.kcal,
      protein: per100.protein ?? 0,
      carbs: per100.carbs ?? 0,
      sugars: per100.sugars ?? 0,
      fat: per100.fat ?? 0,
      satFat: per100.satFat ?? 0,
      fiber: per100.fiber ?? 0,
      sodium: per100.sodium ?? 0,
    },
    group: 'mixed',
    aliases: [],
    source: { primary: 'url', url },
    qa: {
      verifiedAt: null,
      confidence: 'low',
      cross: ['url'],
      note: 'Imported from a web page — check the figures against the pack.',
    },
  };
}

// Deep-searches the page's embedded JSON (Next.js __NEXT_DATA__,
// window.__STATE__ blobs, <script type=application/json>, or a raw
// JSON API response) for nutrition data. This is what catches SPA
// product pages where the NIP isn't in the static HTML.
function extractEmbeddedJson(text) {
  const blobs = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) blobs.push(trimmed);
  for (const m of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1].trim();
    if (!body || body.length > 800000) continue;
    if (body.startsWith('{') || body.startsWith('[')) { blobs.push(body); continue; }
    // window.__SOMETHING__ = { ... };
    const assign = body.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (assign) blobs.push(assign[1]);
  }
  for (const blob of blobs) {
    let data;
    try { data = JSON.parse(blob); } catch { continue; }
    const nut = deepFindNutrition(data, 0);
    if (nut) {
      if (!nut.name) nut.name = deepFindName(data, 0);
      return nut;
    }
  }
  return null;
}

function deepFindNutrition(node, depth) {
  if (node == null || depth > 9) return null;
  if (typeof node === 'string') {
    // An AU-format NIP serialised as a single string.
    if (/energy/i.test(node) && /protein/i.test(node)
        && /(kj|kcal|cal)\b/i.test(node) && node.length < 6000) {
      const nip = extractNipHeuristic(node);
      if (nip?.per100?.kcal != null) return { per100: nip.per100, servingSize: nip.servingSize };
    }
    return null;
  }
  if (Array.isArray(node)) {
    for (const x of node) { const f = deepFindNutrition(x, depth + 1); if (f) return f; }
    return null;
  }
  if (typeof node === 'object') {
    const direct = nutritionFromObject(node);
    if (direct) return direct;
    for (const k of Object.keys(node)) {
      const f = deepFindNutrition(node[k], depth + 1);
      if (f) return f;
    }
  }
  return null;
}

// Recognise an object that directly carries nutrient fields (schema.org
// NutritionInformation or a plain {protein, carbs, fat, energy} shape).
function nutritionFromObject(o) {
  const energyRaw = o.calories ?? o.energyContent ?? o.energy ?? o.Energy ?? o.kilojoules ?? o.kJ;
  const protein = o.proteinContent ?? o.protein ?? o.Protein;
  const carbs   = o.carbohydrateContent ?? o.carbohydrate ?? o.carbs ?? o.Carbohydrate;
  const fat     = o.fatContent ?? o.fat ?? o.Fat ?? o.totalFat;
  if (energyRaw == null) return null;
  if ([protein, carbs, fat].filter((x) => x != null).length === 0) return null;
  let kcal = parseSchemaNum(energyRaw);
  const energyStr = String(energyRaw).toLowerCase();
  if (kcal != null && /kj/.test(energyStr) && !/cal/.test(energyStr)) kcal = Math.round(kcal / 4.184);
  if (kcal == null) return null;
  return {
    per100: {
      kcal,
      protein: parseSchemaNum(protein),
      carbs:   parseSchemaNum(carbs),
      sugars:  parseSchemaNum(o.sugarContent ?? o.sugars ?? o.Sugars),
      fat:     parseSchemaNum(fat),
      satFat:  parseSchemaNum(o.saturatedFatContent ?? o.saturatedFat ?? o.satFat),
      fiber:   parseSchemaNum(o.fiberContent ?? o.fibreContent ?? o.fiber ?? o.fibre ?? o.dietaryFibre),
      sodium:  parseSchemaNum(o.sodiumContent ?? o.sodium ?? o.Sodium),
    },
    servingSize: parseQuantity(o.servingSize) || parseQuantity(o.ServingSize),
  };
}

function deepFindName(node, depth) {
  if (node == null || depth > 6 || typeof node !== 'object') return null;
  for (const key of ['name', 'Name', 'displayName', 'DisplayName', 'productName', 'title', 'Description']) {
    const v = node[key];
    if (typeof v === 'string' && v.length >= 3 && v.length <= 90 && !/^https?:/i.test(v)) return v.trim();
  }
  for (const k of Object.keys(node)) {
    const f = deepFindName(node[k], depth + 1);
    if (f) return f;
  }
  return null;
}

function extractNutritionJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const node = findProductNode(data);
      if (!node) continue;
      const n = node.nutrition;
      if (!n) continue;
      const kcal = parseSchemaNum(n.calories) ?? (parseSchemaNum(n.energyContent) != null
        ? Math.round(parseSchemaNum(n.energyContent) / 4.184) : null);
      return {
        name: node.name,
        brand: typeof node.brand === 'string' ? node.brand : node.brand?.name,
        servingSize: parseQuantity(n.servingSize) || parseQuantity(node.servingSize),
        per100: {
          kcal,
          protein: parseSchemaNum(n.proteinContent),
          carbs:   parseSchemaNum(n.carbohydrateContent),
          sugars:  parseSchemaNum(n.sugarContent),
          fat:     parseSchemaNum(n.fatContent),
          satFat:  parseSchemaNum(n.saturatedFatContent),
          fiber:   parseSchemaNum(n.fiberContent),
          sodium:  parseSchemaNum(n.sodiumContent, true),
        },
      };
    } catch { /* skip block */ }
  }
  return null;
}

function findProductNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const x of node) { const f = findProductNode(x); if (f) return f; }
    return null;
  }
  if (typeof node === 'object') {
    const t = node['@type'];
    const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
    if (isProduct && node.nutrition) return node;
    if (node['@graph']) { const f = findProductNode(node['@graph']); if (f) return f; }
    for (const k of Object.keys(node)) {
      if (k === '@graph') continue;
      const f = findProductNode(node[k]);
      if (f) return f;
    }
  }
  return null;
}

// Pulls "8 g" / "150 calories" / "43 mg" → number. `mg` keeps mg units.
function parseSchemaNum(v) {
  if (v == null) return null;
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Heuristic NIP scrape from the page's plain text.
function extractNipHeuristic(html) {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!/energy|nutrition/.test(plain)) return null;

  // Capture up to two "number unit" values after a label; the last is
  // the per-100 column on a standard FSANZ panel. Wide gap windows so
  // markdown tables and verbose "per serving / per 100 g" headers
  // between the values don't break the match.
  const last = (labelAlt, unit) => {
    const re = new RegExp(
      `(?:${labelAlt})[^\\d]{0,45}?(\\d+(?:\\.\\d+)?)\\s*${unit}\\b(?:[^\\d]{0,45}?(\\d+(?:\\.\\d+)?)\\s*${unit}\\b)?`,
      'i'
    );
    const m = plain.match(re);
    if (!m) return null;
    return m[2] != null ? parseFloat(m[2]) : parseFloat(m[1]);
  };

  const energyKj = last('energy', 'kj');
  const energyKcal = last('energy', 'k?cal') ?? (energyKj != null ? Math.round(energyKj / 4.184) : null);
  const servingSize = (() => {
    const m = plain.match(/serving size[^\d]{0,15}(\d+(?:\.\d+)?)\s*(g|ml)/i);
    return m ? parseFloat(m[1]) : null;
  })();
  const liquid = /\b\d+\s*ml\b/.test(plain) && !/\b\d+\s*g\b/.test(plain.slice(0, plain.indexOf('energy') + 200));

  const per100 = {
    kcal: energyKcal,
    protein: last('protein', 'g'),
    fat:     last('fat[, ]*total|total fat|fat', 'g'),
    satFat:  last('saturated', 'g'),
    carbs:   last('carbohydrate[, ]*total|total carbohydrate|carbohydrate', 'g'),
    sugars:  last('sugars', 'g'),
    fiber:   last('dietary fibre|dietary fiber|fibre|fiber', 'g'),
    sodium:  last('sodium', 'mg'),
  };
  return { per100, servingSize, liquid };
}

function extractPageTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return cleanTitle(og[1]);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return cleanTitle(t[1]);
  return null;
}
function cleanTitle(s) {
  return s.replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ')
    .split(/[|–—]/)[0].trim().slice(0, 80);
}
function hostBrand(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/woolworths/.test(h)) return 'Woolworths';
    if (/coles/.test(h)) return 'Coles';
    if (/aldi/.test(h)) return 'ALDI';
    return h.split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return 'From link';
  }
}
