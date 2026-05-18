// Cloudflare Worker reference for Built Different's brand-food proxy.
//
// Endpoints:
//   GET  /lookup?barcode=<gtin>
//   GET  /search?q=<query>
//   POST /ocr   (multipart, field "image")
//
// Source priority: Woolworths product API → manufacturer site (best-effort
// scrape) → not found.
//
// Deploy:
//   wrangler secret put GOOGLE_VISION_KEY     # for /ocr
//   wrangler deploy
//
// CORS is open by default — tighten to your hosted Built Different
// origin in production by editing CORS_ALLOW_ORIGIN below.

const CORS_ALLOW_ORIGIN = '*';
const CORS = {
  'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const UA = 'BuiltDifferentProxy/1.0';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    try {
      if (url.pathname === '/lookup' && request.method === 'GET') {
        return json(await lookupBarcode(url.searchParams.get('barcode'), env, ctx));
      }
      if (url.pathname === '/search' && request.method === 'GET') {
        return json(await searchText(url.searchParams.get('q'), env, ctx));
      }
      if (url.pathname === '/ocr' && request.method === 'POST') {
        return json(await ocrImage(request, env));
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'internal', message: String(e?.message || e) }, 500);
    }
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ---- Barcode lookup ----
async function lookupBarcode(barcode, env, ctx) {
  if (!barcode) return { found: false };

  const cacheKey = `barcode:${barcode}`;
  const cached = await env.CACHE_KV?.get(cacheKey, 'json');
  if (cached) return cached;

  // Woolworths public search-by-keyword often returns the GTIN as a hit.
  const w = await tryWoolworthsByBarcode(barcode);
  if (w) {
    const out = { found: true, source: 'woolworths', food: w };
    ctx.waitUntil(env.CACHE_KV?.put(cacheKey, JSON.stringify(out), { expirationTtl: 86400 }));
    return out;
  }

  return { found: false };
}

async function tryWoolworthsByBarcode(barcode) {
  // The public Woolworths PDP exposes structured data via their search and
  // product endpoints. This is illustrative — adapt to whatever endpoint
  // is current. Use POST to Search/products with searchTerm = barcode.
  const r = await fetch('https://www.woolworths.com.au/apis/ui/Search/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Accept': 'application/json' },
    body: JSON.stringify({
      SearchTerm: barcode, PageSize: 4, PageNumber: 1,
      SortType: 'TraderRelevance', Filters: [], IsSpecial: false,
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const product = data?.Products?.[0]?.Products?.[0];
  if (!product) return null;
  return woolworthsProductToFood(product, barcode);
}

function woolworthsProductToFood(p, barcode) {
  const np = p.AdditionalAttributes?.nutritionalinformation || {};
  const per100 = parseNIP(np);
  if (!per100) return null;
  return {
    id: 'wool_' + p.Stockcode,
    barcode,
    brand: p.Brand || 'Unbranded',
    name: stripBrand(p.Name, p.Brand),
    variant: '',
    serving: parseServingFromAttr(p.AdditionalAttributes) || { size: 100, unit: 'g', label: '100 g' },
    package: parsePackageFromAttr(p) || { size: 100, unit: 'g' },
    per100,
    group: groupHint(p.Categories?.[0]?.Name || ''),
    aliases: [],
    source: { primary: 'woolworths', url: `https://www.woolworths.com.au/shop/productdetails/${p.Stockcode}` },
    qa: { verifiedAt: new Date().toISOString().slice(0, 10), confidence: 'medium', cross: ['woolworths'] },
  };
}

function parseNIP(np) {
  // Woolworths "nutritionalinformation" attribute is a string like:
  // "Energy 350kJ; Protein 9.7g; Fat Total 2.0g; ..."
  if (!np || typeof np !== 'string') return null;
  const get = (re) => { const m = np.match(re); return m ? parseFloat(m[1]) : null; };
  const energyKj = get(/energy[^;]*?(\d+(?:\.\d+)?)\s*kJ/i);
  const energyKcal = energyKj ? energyKj / 4.184 : get(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (energyKcal == null) return null;
  return {
    kcal:    Math.round(energyKcal),
    protein: get(/protein[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    carbs:   get(/carbohydrate[^;]*?total[^;]*?(\d+(?:\.\d+)?)\s*g/i) || get(/carbohydrate[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    sugars:  get(/sugars[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    fat:     get(/fat[^;]*?total[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    satFat:  get(/saturated[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    fiber:   get(/(?:fiber|fibre|dietary fibre)[^;]*?(\d+(?:\.\d+)?)\s*g/i) || 0,
    sodium:  get(/sodium[^;]*?(\d+(?:\.\d+)?)\s*mg/i) || 0,
  };
}

function parseServingFromAttr(a) { /* stub — adapt to current schema */ return null; }
function parsePackageFromAttr(p)  { /* stub — adapt to current schema */ return null; }
function stripBrand(name, brand) { return brand && name ? name.replace(new RegExp(`^${brand}\\s*`, 'i'), '') : name; }

function groupHint(cat) {
  const c = (cat || '').toLowerCase();
  if (/dairy|yogurt|milk|cheese/.test(c)) return 'dairy';
  if (/bread|cereal|pasta|rice|grain|bakery/.test(c)) return 'grain';
  if (/meat|seafood|deli|fish/.test(c)) return 'protein';
  if (/fruit/.test(c)) return 'fruit';
  if (/veg/.test(c)) return 'veg';
  if (/snack|biscuit|chocolate/.test(c)) return 'snack';
  if (/drink|beverage/.test(c)) return 'beverage';
  return 'mixed';
}

// ---- Text search ----
async function searchText(q, env, ctx) {
  if (!q) return { source: 'woolworths', results: [] };
  const r = await fetch('https://www.woolworths.com.au/apis/ui/Search/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Accept': 'application/json' },
    body: JSON.stringify({
      SearchTerm: q, PageSize: 6, PageNumber: 1,
      SortType: 'TraderRelevance', Filters: [], IsSpecial: false,
    }),
  });
  if (!r.ok) return { source: 'woolworths', results: [] };
  const data = await r.json();
  const products = (data?.Products || []).flatMap((g) => g.Products || []).slice(0, 6);
  const results = products.map((p) => woolworthsProductToFood(p, p.Barcode || '')).filter(Boolean);
  return { source: 'woolworths', results };
}

// ---- OCR ----
async function ocrImage(request, env) {
  if (!env.GOOGLE_VISION_KEY) return { text: '', error: 'GOOGLE_VISION_KEY not configured' };
  const form = await request.formData();
  const file = form.get('image');
  if (!file || typeof file === 'string') return { text: '' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const b64 = btoa(String.fromCharCode(...bytes));
  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: b64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
    }),
  });
  const data = await r.json();
  const text = data?.responses?.[0]?.fullTextAnnotation?.text || '';
  return { text };
}
