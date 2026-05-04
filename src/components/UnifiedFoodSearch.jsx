import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { searchBrandFoods, findBrandFoodById, BRAND_FOODS, validateBrandFood } from '../utils/brandFoods.js';
import { searchFoods } from '../data/foods.js';
import { lookupByBarcode, lookupByText } from '../utils/foodLookup.js';
import ServingCalculator from './ServingCalculator.jsx';
import MicField from './MicField.jsx';

const BarcodeSheet = lazy(() => import('./CameraSheet.jsx'));

// One unified food picker. Search-as-you-type returns a single merged
// list spanning:
//   1. Curated brand foods (instant, offline)
//   2. Generic foods + custom foods (instant, offline)
//   3. Live results (server proxy / Open Food Facts) — only if the
//      curated/generic results are thin or none.
//
// Each result has a Preview button that opens an inline calculator
// with the macros + serving controls. The user accepts from there.
//
// Replaces the previous split between BrandFoodSearch (brand-only) and
// the voice/text VoiceInput's parser path. Voice still goes through the
// transcript parser at the top of the page; this component is for
// browsing-and-picking.
//
// Props:
//   onLogEntry(entry) — entry shape ready for state.foodEntries
//   meal              — current meal slot
//   recentIds         — recently-logged brandFoodIds
//   favouriteIds      — starred brandFoodIds
//   onToggleFav       — flip favourite
//   brandUsage        — { [id]: usage }
//   cachedBrands      — { [id]: full food object } for OFF/proxy results
//   settings          — { proxyEndpoint, enableOFF }
export default function UnifiedFoodSearch({
  onLogEntry, meal, recentIds = [], favouriteIds = [],
  onToggleFav, brandUsage = {}, cachedBrands = {}, settings = {},
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);   // food object being previewed
  const [scanning, setScanning] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState([]);
  const [liveError, setLiveError] = useState('');
  const inputRef = useRef(null);

  // Merged static results: brand + generic.
  const staticResults = useMemo(() => {
    if (!query || query.trim().length < 2) return [];
    const brand = searchBrandFoods(query, 6).map((f) => ({ kind: 'brand', food: f }));
    const generic = searchFoods(query, 6).map((f) => ({ kind: 'generic', food: f }));
    // De-dupe: brand wins over generic for any equivalent name.
    const seen = new Set(brand.map((b) => b.food.name.toLowerCase()));
    const out = [...brand];
    for (const g of generic) {
      if (!seen.has(g.food.name.toLowerCase())) {
        seen.add(g.food.name.toLowerCase());
        out.push(g);
      }
    }
    return out.slice(0, 8);
  }, [query]);

  // Live lookup only when curated/generic results are thin.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || staticResults.length >= 4) {
      setLiveResults([]); setLiveError(''); setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true); setLiveError('');
    const handle = setTimeout(async () => {
      try {
        const r = await lookupByText(trimmed, settings);
        if (cancelled) return;
        const extras = r.filter((x) => x.source !== 'curated');
        setLiveResults(extras.map((x) => ({ kind: 'live', food: x.food, source: x.source })));
      } catch {
        if (!cancelled) setLiveError("Couldn't reach live lookup. Showing curated and generic only.");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, staticResults.length, settings]);

  const recents = useMemo(() => uniqueBrandFoods(recentIds, 4, cachedBrands), [recentIds, cachedBrands]);
  const favourites = useMemo(() => uniqueBrandFoods(favouriteIds, 6, cachedBrands), [favouriteIds, cachedBrands]);

  const browse = !query;
  const allResults = useMemo(() => [...staticResults, ...liveResults], [staticResults, liveResults]);

  const handleScan = async (code) => {
    setScanning(false);
    setLiveLoading(true); setLiveError('');
    try {
      const r = await lookupByBarcode(code, settings);
      if (r?.food) {
        setSelected(r.food);
        setQuery(r.food.brand ? `${r.food.brand} ${r.food.name}` : r.food.name);
      } else {
        setLiveError(`No match for barcode ${code}.`);
      }
    } catch {
      setLiveError('Lookup failed. Try typing the brand instead.');
    } finally {
      setLiveLoading(false);
    }
  };

  const handleAccept = (entry) => {
    onLogEntry?.(entry);
    setSelected(null);
    setQuery('');
  };

  return (
    <section className="card p-4 sm:p-5 fade-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-lg leading-tight">Search foods or brands</h3>
          <p className="text-[11px] text-muted">Curated → generic → online if needed</p>
        </div>
        <span className="chip">{BRAND_FOODS.length}+ brands</span>
      </div>

      <div className="flex gap-2">
        <MicField ref={inputRef}
          wrapperClassName="flex-1"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Chobani vanilla, 150g chicken, an apple…"
          className="input"
          aria-label="Search foods or brands"
        />
        <button onClick={() => setScanning(true)}
          className="shrink-0 w-10 h-10 rounded-md bg-caramel text-canvas flex items-center justify-center hover:bg-toast"
          aria-label="Scan barcode">
          <BarcodeIcon/>
        </button>
      </div>

      {browse && favourites.length > 0 && (
        <Section title="Favourites">
          <div className="flex flex-wrap gap-1.5">
            {favourites.map((f) => (
              <button key={f.id} onClick={() => setSelected(f)}
                className="chip bg-blush border border-rose/30 text-cocoa hover:bg-petal">
                ★ {f.brand} · {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {browse && recents.length > 0 && (
        <Section title="Recent">
          <div className="flex flex-wrap gap-1.5">
            {recents.map((f) => (
              <button key={f.id} onClick={() => setSelected(f)}
                className="chip hover:bg-stone">
                {f.brand} · {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {browse && (
        <Section title="Browse curated">
          <ResultList items={BRAND_FOODS.slice(0, 6).map((f) => ({ kind: 'brand', food: f }))}
            onSelect={setSelected} selectedId={selected?.id}/>
          <p className="text-[11px] text-muted mt-2">{BRAND_FOODS.length} brands curated. Type to search wider.</p>
        </Section>
      )}

      {!browse && (
        <div className="mt-3">
          {allResults.length === 0 && !liveLoading ? (
            <div className="text-sm text-muted py-2">
              No match for "<span className="text-cocoa">{query}</span>". Press the mic and dictate the full quantity to log directly.
            </div>
          ) : (
            <ResultList items={allResults} onSelect={setSelected} selectedId={selected?.id}/>
          )}
          {liveLoading && (
            <div className="text-[11px] text-muted mt-2 inline-flex items-center gap-2">
              <Spinner/> Searching online…
            </div>
          )}
          {liveError && <div className="text-[11px] text-rose mt-2">{liveError}</div>}
        </div>
      )}

      {selected && (
        <PreviewBlock
          food={selected}
          meal={meal}
          isFavourite={favouriteIds.includes(selected.id)}
          onToggleFav={onToggleFav}
          lastUsage={brandUsage[selected.id] || null}
          onAccept={handleAccept}
          onClose={() => setSelected(null)}
        />
      )}

      {scanning && (
        <Suspense fallback={null}>
          <BarcodeSheet onScan={handleScan} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </section>
  );
}

// Inline preview that mounts ServingCalculator (for brands) or a simple
// generic editor (for foods that don't have a per100 panel like brands).
function PreviewBlock({ food, meal, isFavourite, onToggleFav, lastUsage, onAccept, onClose }) {
  // Brand foods have a per100 + serving + package shape.
  const isBrand = !!food.per100;
  if (isBrand) {
    return (
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Preview</p>
          <button onClick={onClose} className="text-muted hover:text-cocoa text-xs">× Close</button>
        </div>
        <ServingCalculator
          food={food}
          meal={meal}
          isFavourite={isFavourite}
          onToggleFav={onToggleFav}
          lastUsage={lastUsage}
          onLog={onAccept}
        />
      </div>
    );
  }
  return (
    <GenericPreview food={food} meal={meal} onAccept={onAccept} onClose={onClose}/>
  );
}

// Lightweight preview for generic foods — show macros at default
// quantity, let user adjust amount, then accept.
function GenericPreview({ food, meal, onAccept, onClose }) {
  const isPiece = food.unit === 'piece';
  const [amount, setAmount] = useState(isPiece ? 1 : food.per || 100);
  const macros = useMemo(() => {
    const factor = isPiece ? amount : amount / (food.per || 100);
    return {
      kcal:    Math.round((food.kcal || 0) * factor),
      protein: Math.round((food.protein || 0) * factor * 10) / 10,
      carbs:   Math.round((food.carbs   || 0) * factor * 10) / 10,
      fat:     Math.round((food.fat     || 0) * factor * 10) / 10,
      fiber:   Math.round((food.fiber   || 0) * factor * 10) / 10,
      sugars:  Math.round((food.sugars  || 0) * factor * 10) / 10,
    };
  }, [food, amount, isPiece]);

  const accept = () => {
    onAccept({
      foodId: food.id,
      name: food.name,
      amount: Number(amount),
      unit: food.unit,
      group: food.group,
      ...macros,
      raw: `Picked from search · ${amount} ${food.unit}`,
    });
  };

  return (
    <div className="mt-3 rounded-md border border-stone bg-canvas p-4 fade-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Preview</p>
          <h4 className="font-display text-base text-chocolate">{food.name}</h4>
          <p className="text-[11px] text-muted">
            {food.unit === 'piece'
              ? `${food.kcal} kcal / piece${food.pieceGrams ? ` (${food.pieceGrams} g)` : ''}`
              : `${food.kcal} kcal / ${food.per} ${food.unit}`}
          </p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-cocoa text-xs">× Close</button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setAmount((a) => Math.max(0, Math.round((Number(a) - (isPiece ? 1 : 10)) * 10) / 10))}
          className="w-10 h-10 rounded-md bg-white border border-stone text-cocoa text-lg active:scale-95">−</button>
        <input type="number" inputMode="decimal" min="0" step={isPiece ? 1 : 10}
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          className="input text-center flex-1"/>
        <span className="text-xs text-muted w-12 text-center">{food.unit}</span>
        <button onClick={() => setAmount((a) => Math.round((Number(a) + (isPiece ? 1 : 10)) * 10) / 10)}
          className="w-10 h-10 rounded-md bg-white border border-stone text-cocoa text-lg active:scale-95">+</button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat label="kcal" value={macros.kcal} accent/>
        <Stat label="P" value={`${macros.protein}g`}/>
        <Stat label="C" value={`${macros.carbs}g`}/>
        <Stat label="F" value={`${macros.fat}g`}/>
        <Stat label="Fb" value={`${macros.fiber}g`}/>
        <Stat label="Sug" value={`${macros.sugars}g`}/>
      </div>

      <div className="flex justify-end mt-3 gap-2">
        <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
        <button onClick={accept} className="btn-primary text-sm">Accept + log</button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`rounded-md px-2 py-1.5 text-center ${accent ? 'bg-caramel text-canvas' : 'bg-white border border-stone'}`}>
      <div className={`text-[9px] uppercase tracking-wide ${accent ? 'text-canvas/80' : 'text-muted'}`}>{label}</div>
      <div className={`font-display text-base ${accent ? 'text-canvas' : 'text-chocolate'}`}>{value}</div>
    </div>
  );
}

function ResultList({ items, onSelect, selectedId }) {
  return (
    <ul className="divide-y divide-stone">
      {items.map(({ kind, food, source }) => {
        const v = kind === 'brand' ? validateBrandFood(food) : { valid: true, warnings: [] };
        const active = selectedId === food.id;
        return (
          <li key={food.id}>
            <button onClick={() => onSelect(food)}
              className={`w-full text-left py-2.5 px-2 rounded-md flex items-center gap-2 transition ${
                active ? 'bg-blush' : 'hover:bg-oat'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {kind === 'brand' && (
                    <span className="text-[10px] font-medium text-cocoa bg-blush rounded px-1.5 py-0.5 shrink-0">
                      {food.brand}
                    </span>
                  )}
                  <span className="font-medium truncate">{food.name}{food.variant ? ` · ${food.variant}` : ''}</span>
                  {kind === 'live' && <SourcePill source={source}/>}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {kind === 'brand'
                    ? `${food.serving.label} · ${Math.round((food.per100.kcal * food.serving.size) / 100)} kcal`
                    : food.unit === 'piece'
                      ? `${food.kcal} kcal / piece`
                      : `${food.kcal} kcal / ${food.per} ${food.unit}`
                  }
                </div>
              </div>
              {!v.valid && (
                <span title={v.warnings.join(', ')}
                  className="text-[10px] bg-rose/20 text-toast px-1.5 py-0.5 rounded shrink-0">Check</span>
              )}
              <span className="text-caramel text-[11px] font-medium px-2">Preview →</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SourcePill({ source }) {
  const cfg = source === 'woolworths' ? { label: 'Woolworths', cls: 'bg-caramel/20 text-cocoa' }
    : source === 'proxy' || source === 'manufacturer' ? { label: 'Live', cls: 'bg-amber/30 text-cocoa' }
    : { label: 'OFF', cls: 'bg-stone text-muted' };
  return <span className={`text-[9px] uppercase tracking-wide rounded px-1 py-0.5 ${cfg.cls}`}>{cfg.label}</span>;
}

function uniqueBrandFoods(ids, limit, cache) {
  const seen = new Set(); const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const f = findBrandFoodById(id) || cache?.[id];
    if (f) { out.push(f); seen.add(id); if (out.length >= limit) break; }
  }
  return out;
}

function Section({ title, children }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase tracking-wide text-muted mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function BarcodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M3 5v14M7 5v14M11 5v14M14 5v14M17 5v14M21 5v14"/>
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
    </svg>
  );
}
