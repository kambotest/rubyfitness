import { useMemo, useState } from 'react';
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

// Best-effort: fetch a URL via a public read-only proxy and extract recipe ingredients
// from JSON-LD or schema.org markup. Falls back to nothing if blocked.
async function fetchRecipeIngredients(url) {
  const u = url.startsWith('http') ? url : `https://${url}`;
  // Public CORS-friendly readers (best-effort; user can paste ingredients if blocked).
  const proxies = [
    (x) => `https://r.jina.ai/${x}`,
    (x) => `https://corsproxy.io/?${encodeURIComponent(x)}`,
  ];
  for (const p of proxies) {
    try {
      const res = await fetch(p(u), { method: 'GET' });
      if (!res.ok) continue;
      const text = await res.text();
      const ings = extractIngredientsFromHtml(text);
      if (ings.length) return ings;
    } catch { /* try next */ }
  }
  return [];
}

function extractIngredientsFromHtml(html) {
  // 1) Try JSON-LD blocks
  const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1].trim());
      const found = findRecipeIngredients(data);
      if (found && found.length) return found;
    } catch { /* skip */ }
  }
  // 2) Fallback: grab anything that looks like an ingredient list
  const liMatches = [...html.matchAll(/<li[^>]*itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length) return liMatches.map((m) => stripTags(m[1]).trim()).filter(Boolean);
  return [];
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
