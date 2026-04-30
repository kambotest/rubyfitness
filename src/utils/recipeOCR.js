// Optical character recognition for photographed printed recipes (e.g. a
// cookbook page). Uses tesseract.js, dynamically imported so the heavy WASM
// + language data only ship when the user actually taps "Photograph
// recipe". Returns plain text the user can review and edit before parsing.
//
// If the user has configured a server proxy with an /ocr endpoint, we send
// the image there instead — proxies typically use Google Vision or Azure
// Read which are much more accurate on cookbook fonts than client-side
// Tesseract. Falls back to Tesseract on any failure.

let tesseractPromise = null;

export async function recogniseRecipeText(file, { proxyEndpoint, onProgress } = {}) {
  if (proxyEndpoint) {
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(`${proxyEndpoint.replace(/\/+$/, '')}/ocr`, { method: 'POST', body: fd });
      if (r.ok) {
        const data = await r.json();
        if (data?.text) return data.text;
      }
    } catch { /* fall through to client-side */ }
  }

  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js');
  }
  const Tesseract = await tesseractPromise;
  const create = Tesseract.createWorker || Tesseract.default?.createWorker;
  if (!create) throw new Error('Tesseract.js not available');

  const worker = await create('eng', 1, {
    logger: (m) => onProgress?.(m.status, typeof m.progress === 'number' ? m.progress : 0),
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } finally {
    try { await worker.terminate(); } catch { /* ignore */ }
  }
}

// Helper: turn raw OCR text into ingredient lines suitable for the food
// parser. Cookbook layouts often look like:
//
//   Ingredients
//   200 g plain flour
//   2 tbsp olive oil
//   1 onion, diced
//   ...
//
// We strip headings/numbering, drop instruction blocks (long sentences
// without numeric quantities), and join ingredient-looking lines with
// "and" so the existing splitItems() can separate them.
export function ocrToIngredientText(raw) {
  if (!raw) return '';
  const lines = raw.split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const looksIngredient = (l) =>
    /\d/.test(l) ||                            // contains a number
    /^[•\-*]/.test(l) ||                       // bullet
    /\b(g|kg|ml|l|tsp|tbsp|cup|cups|slice|slices|piece|pieces)\b/i.test(l);

  const stop = /^(method|directions|instructions|steps|how to|preparation|notes)\b/i;
  const out = [];
  for (const l of lines) {
    if (stop.test(l)) break;
    if (looksIngredient(l) && l.length < 120) out.push(stripBullets(l));
  }
  return out.join(' and ');
}

const stripBullets = (s) => s.replace(/^[•\-*\d\.\)\s]+/, '').trim();
