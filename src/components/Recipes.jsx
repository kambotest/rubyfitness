import { useMemo, useRef, useState } from 'react';
import VoiceInput from './VoiceInput.jsx';
import { parseFoodTranscript } from '../utils/parser.js';
import { findFood, nutrientsFor } from '../data/foods.js';
import { newId, todayISO } from '../utils/storage.js';

// Recipes: paste / dictate ingredients, app parses & shows per-serve macros.
// Optionally save to your recipe book and quick-log a serving.
export default function Recipes({ state, setState }) {
  const [tab, setTab] = useState('new');     // 'new' | 'book'

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Recipes</p>
          <h1 className="font-display text-3xl">Cook once, log easy</h1>
        </div>
        <div className="flex gap-1">
          {['new','book'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${tab===t ? 'bg-moss text-cream' : 'bg-white/60 text-plum border border-sand'}`}>
              {t === 'new' ? 'New' : `Book (${state.recipes.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'new' && <RecipeBuilder state={state} setState={setState} />}
      {tab === 'book' && <RecipeBook state={state} setState={setState} />}
    </div>
  );
}

function RecipeBuilder({ state, setState }) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState(4);
  const [items, setItems] = useState([]);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');
  const [photoText, setPhotoText] = useState('');
  const fileRef = useRef(null);

  const totals = useMemo(() => sumItems(items), [items]);
  const perServe = scale(totals, 1 / Math.max(1, servings));

  const addFromText = (text) => {
    const parsed = parseFoodTranscript(text);
    if (!parsed.length) return;
    setItems((prev) => [
      ...prev,
      ...parsed.filter((p) => !p.unknown).map((p) => ({ id: newId(), ...p })),
    ]);
  };

  const removeItem = (id) => setItems((arr) => arr.filter((x) => x.id !== id));

  const handlePhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true); setPhotoStatus('Loading text recogniser…'); setPhotoText('');
    try {
      const { recogniseRecipeText, ocrToIngredientText } = await import('../utils/recipeOCR.js');
      const raw = await recogniseRecipeText(file, {
        proxyEndpoint: state.settings?.proxyEndpoint,
        onProgress: (status, p) => setPhotoStatus(`${status}${p ? ' ' + Math.round(p * 100) + '%' : ''}`),
      });
      const cleaned = ocrToIngredientText(raw);
      setPhotoText(cleaned || raw);
      setPhotoStatus(cleaned ? 'Found ingredients — review and edit before adding.' : "Couldn't pick out ingredient lines. Edit the text below.");
    } catch (e) {
      setPhotoStatus(`Could not read the image: ${e.message || e}`);
    } finally {
      setPhotoBusy(false);
    }
  };

  const usePhotoText = () => {
    if (!photoText.trim()) return;
    addFromText(photoText);
    setPhotoText(''); setPhotoStatus('');
  };

  const importFromLink = async () => {
    if (!link.trim()) return;
    setLinkBusy(true); setLinkError('');
    try {
      const ingredients = await fetchRecipeIngredients(link.trim());
      if (!ingredients.length) {
        setLinkError("Couldn't read ingredients from that link. Try pasting them in below.");
      } else {
        addFromText(ingredients.join(' and '));
      }
    } catch (e) {
      setLinkError("Network/CORS blocked the fetch. Paste ingredients in below.");
    } finally {
      setLinkBusy(false);
    }
  };

  const saveRecipe = () => {
    if (!name.trim() || !items.length) return;
    const recipe = {
      id: newId(),
      name: name.trim(),
      servings: Math.max(1, +servings || 1),
      items,
      perServe,
      createdAt: todayISO(),
    };
    setState({ ...state, recipes: [recipe, ...state.recipes] });
    setName(''); setItems([]); setServings(4); setLink('');
  };

  const logOneServe = () => {
    if (!items.length) return;
    const entry = {
      id: newId(), date: todayISO(), meal: 'meal',
      foodId: 'recipe',
      name: name.trim() || 'Recipe (1 serve)',
      amount: 1, unit: 'serve',
      ...perServe,
      raw: 'Recipe — 1 serve',
    };
    setState({ ...state, foodEntries: [...state.foodEntries, entry] });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div className="grid sm:grid-cols-[2fr_1fr] gap-3">
          <input value={name} onChange={(e)=>setName(e.target.value)}
            className="input" placeholder="Recipe name (e.g. Salmon power bowl)"/>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Servings</label>
            <input type="number" min="1" value={servings} onChange={(e)=>setServings(e.target.value)}
              className="input w-24"/>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input value={link} onChange={(e)=>setLink(e.target.value)}
            className="input flex-1" placeholder="Paste a recipe link (optional)…"/>
          <button onClick={importFromLink} disabled={linkBusy} className="btn-soft">
            {linkBusy ? 'Reading…' : 'Import ingredients'}
          </button>
        </div>
        {linkError && <p className="text-xs text-rose">{linkError}</p>}

        <div className="border-t border-sand pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}/>
            <button onClick={() => fileRef.current?.click()} disabled={photoBusy}
              className="btn-soft flex items-center gap-2">
              <CameraIcon/> {photoBusy ? 'Reading photo…' : 'Photograph recipe'}
            </button>
            {photoStatus && <span className="text-xs text-muted">{photoStatus}</span>}
          </div>
          <p className="text-[11px] text-muted mt-1">
            Snap a printed recipe (cookbook, magazine). We'll extract the ingredient lines so you can review them before adding.
          </p>
          {photoText && (
            <div className="mt-2 space-y-2">
              <textarea value={photoText} onChange={(e) => setPhotoText(e.target.value)}
                rows={4} className="input" placeholder="Edit the extracted ingredients…"/>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setPhotoText(''); setPhotoStatus(''); }} className="btn-ghost text-sm">Discard</button>
                <button onClick={usePhotoText} className="btn-primary text-sm">Add as ingredients</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <VoiceInput
        placeholder='Dictate ingredients — e.g. “200g chicken, 1 cup rice, 2 cups broccoli, 1 tbsp olive oil”'
        onSubmit={addFromText}
      />

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">Ingredients</h3>
          <div className="text-xs text-muted">{items.length} item{items.length===1?'':'s'}</div>
        </div>

        {!items.length ? (
          <div className="text-sm text-muted italic py-2">Add ingredients above to see macros per serve.</div>
        ) : (
          <ul className="divide-y divide-sand/70">
            {items.map((it) => (
              <li key={it.id} className="py-2 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted">
                    {it.amount} {it.unit} · {it.kcal} kcal · {it.protein}p · {it.carbs}c · {it.fat}f
                  </div>
                </div>
                <button onClick={() => removeItem(it.id)} className="text-muted hover:text-rose text-xs">×</button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-sand">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <Stat label="Per serve" value={`${perServe.kcal} kcal`} highlight />
              <Stat label="Protein" value={`${perServe.protein} g`} />
              <Stat label="Carbs" value={`${perServe.carbs} g`} />
              <Stat label="Fat" value={`${perServe.fat} g`} />
              <Stat label="Fibre" value={`${perServe.fiber} g`} />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={logOneServe} className="btn-soft">Log 1 serve to today</button>
              <button onClick={saveRecipe} className="btn-primary">Save recipe</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeBook({ state, setState }) {
  if (!state.recipes.length) {
    return <div className="card p-6 text-center text-muted">No saved recipes yet. Build one in “New”.</div>;
  }
  const removeRecipe = (id) =>
    setState({ ...state, recipes: state.recipes.filter((r) => r.id !== id) });
  const logServe = (r) => {
    const entry = {
      id: newId(), date: todayISO(), meal: 'meal',
      foodId: 'recipe', name: `${r.name} (1 serve)`,
      amount: 1, unit: 'serve', ...r.perServe, raw: r.name,
    };
    setState({ ...state, foodEntries: [...state.foodEntries, entry] });
  };
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {state.recipes.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg">{r.name}</h3>
              <p className="text-xs text-muted">{r.servings} serves · {r.items.length} ingredients</p>
            </div>
            <button onClick={() => removeRecipe(r.id)} className="text-muted hover:text-rose text-sm">×</button>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-3 text-center">
            <Stat label="kcal" value={r.perServe.kcal} highlight />
            <Stat label="P" value={`${r.perServe.protein}g`} />
            <Stat label="C" value={`${r.perServe.carbs}g`} />
            <Stat label="F" value={`${r.perServe.fat}g`} />
            <Stat label="Fb" value={`${r.perServe.fiber}g`} />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => logServe(r)} className="btn-soft text-sm">Log 1 serve</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-2xl py-2 ${highlight ? 'bg-moss text-cream' : 'bg-sand/60 text-plum'}`}>
      <div className="font-display text-base leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function sumItems(items) {
  const t = { kcal:0, protein:0, carbs:0, fat:0, fiber:0 };
  items.forEach((i) => {
    t.kcal += i.kcal; t.protein += i.protein; t.carbs += i.carbs;
    t.fat += i.fat; t.fiber += i.fiber;
  });
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein*10)/10,
    carbs: Math.round(t.carbs*10)/10,
    fat: Math.round(t.fat*10)/10,
    fiber: Math.round(t.fiber*10)/10,
  };
}
function scale(t, k) {
  return {
    kcal: Math.round(t.kcal * k),
    protein: Math.round(t.protein * k * 10) / 10,
    carbs: Math.round(t.carbs * k * 10) / 10,
    fat: Math.round(t.fat * k * 10) / 10,
    fiber: Math.round(t.fiber * k * 10) / 10,
  };
}

// Best-effort: fetch a URL via public CORS-friendly readers and extract
// recipe ingredients. Tries (in order):
//   1. JSON-LD Recipe schema (e.g. taste.com.au, BBC Good Food)
//   2. Schema.org itemprop="recipeIngredient" lists
//   3. HTML "Ingredients" heading + following <li> items (editorial sites
//      like ABC News, news.com.au)
//   4. Markdown "Ingredients" heading + following list items (used when
//      r.jina.ai returns the page as cleaned-up Markdown)
async function fetchRecipeIngredients(url) {
  const u = url.startsWith('http') ? url : `https://${url}`;
  const proxies = [
    (x) => `https://r.jina.ai/${x}`,
    (x) => `https://corsproxy.io/?${encodeURIComponent(x)}`,
  ];
  for (const p of proxies) {
    try {
      const res = await fetch(p(u), { method: 'GET' });
      if (!res.ok) continue;
      const text = await res.text();
      const ings = extractIngredients(text);
      if (ings.length) return ings;
    } catch { /* try next */ }
  }
  return [];
}

function extractIngredients(text) {
  return (
    extractFromJsonLd(text) ||
    extractFromItemprop(text) ||
    extractFromHtmlHeading(text) ||
    extractFromMarkdownHeading(text) ||
    []
  );
}

function extractFromJsonLd(html) {
  const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1].trim());
      const found = findRecipeIngredients(data);
      if (found && found.length) return found;
    } catch { /* skip */ }
  }
  return null;
}

function extractFromItemprop(html) {
  const liMatches = [...html.matchAll(/<li[^>]*itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length) return liMatches.map((m) => stripTags(m[1]).trim()).filter(Boolean);
  return null;
}

// Editorial heuristic: find an "Ingredients" heading in raw HTML and
// collect <li> items until the next heading or end-of-section. Works on
// ABC, news.com.au, blogs that don't ship Schema.org markup.
function extractFromHtmlHeading(html) {
  const headingRe = /<h[1-6][^>]*>\s*ingredients?\s*<\/h[1-6]>/i;
  const hMatch = html.match(headingRe);
  if (!hMatch) return null;
  const after = html.slice(hMatch.index + hMatch[0].length);
  // stop at the next heading (Method/Steps/Instructions/Notes or any h2-h4)
  const stopRe = /<h[1-4][^>]*>\s*(?:method|directions|instructions|steps?|how to|notes?|preparation)/i;
  const stopMatch = after.match(stopRe);
  const slice = stopMatch ? after.slice(0, stopMatch.index) : after.slice(0, 8000);
  const liMatches = [...slice.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (!liMatches.length) return null;
  const out = liMatches.map((m) => stripTags(m[1]).trim()).filter((s) => s && s.length < 200);
  return out.length ? out : null;
}

// Markdown heuristic: r.jina.ai returns reader-mode Markdown, not HTML.
// Look for an "Ingredients" heading line and capture list/plain lines
// until the next heading.
function extractFromMarkdownHeading(text) {
  if (!/ingredients/i.test(text)) return null;
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const out = [];
  const isHeading = (l) => /^#{1,4}\s+\S/.test(l) || /^[A-Z][A-Za-z ]{1,30}$/.test(l.trim());
  const isStop = (l) => /^(?:#{1,4}\s+)?\s*(method|directions|instructions|steps?|how to make|notes?|preparation|tips?)\b/i.test(l.trim());
  const isStart = (l) => /^(?:#{1,4}\s+)?\s*ingredients?\s*$/i.test(l.trim());
  for (const line of lines) {
    if (!inSection) { if (isStart(line)) inSection = true; continue; }
    if (isStop(line)) break;
    if (isHeading(line) && !isStart(line)) {
      // probably the next section; stop unless we have nothing yet
      if (out.length) break;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cleaned = trimmed.replace(/^[\-•*•]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
    if (cleaned && cleaned.length < 200 && /[a-z]/i.test(cleaned)) out.push(cleaned);
  }
  return out.length ? out : null;
}

function findRecipeIngredients(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const x of node) {
      const f = findRecipeIngredients(x);
      if (f) return f;
    }
    return null;
  }
  if (typeof node === 'object') {
    const t = node['@type'];
    const isRecipe = t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
    if (isRecipe && Array.isArray(node.recipeIngredient)) return node.recipeIngredient;
    for (const k of Object.keys(node)) {
      const f = findRecipeIngredients(node[k]);
      if (f) return f;
    }
  }
  return null;
}

function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <circle cx="12" cy="13" r="3.5"/>
    </svg>
  );
}
