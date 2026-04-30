import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { searchBrandFoods, findBrandFoodById, BRAND_FOODS, validateBrandFood } from '../utils/brandFoods.js';
import { lookupByBarcode, lookupByText } from '../utils/foodLookup.js';
import ServingCalculator from './ServingCalculator.jsx';

const BarcodeSheet = lazy(() => import('./CameraSheet.jsx'));

// Brand-specific food search for the homepage. Sits above the voice input and
// is collapsed by default so it doesn't crowd the primary mic-first flow.
//
// Lookup chain: curated brand DB (instant) → server proxy (Woolworths /
// manufacturer) → Open Food Facts. Live results merge into the list with
// their source labelled so the user always knows where the figures came
// from. Items found via OFF are tagged "QA seed" until manually verified.
//
// Props:
//   onLogEntry(entry) — entry shape ready for state.foodEntries (with _usage)
//   meal              — current meal slot
//   recentIds         — recently-logged brandFoodIds
//   favouriteIds      — starred brandFoodIds
//   onToggleFav(id)   — flip favourite
//   brandUsage        — { [id]: {lastAmount, lastMode, count, lastDate} }
//   settings          — { proxyEndpoint, enableOFF }
export default function BrandFoodSearch({
  onLogEntry, meal, recentIds = [], favouriteIds = [],
  onToggleFav, brandUsage = {}, cachedBrands = {}, settings = {},
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState([]);
  const [liveError, setLiveError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Curated results show instantly. If we have fewer than 3, kick off the
  // live lookup chain (debounced) to top up with proxy/OFF results.
  const curatedResults = useMemo(() => searchBrandFoods(query, 10), [query]);
  useEffect(() => {
    if (!query || query.trim().length < 3 || curatedResults.length >= 3) {
      setLiveResults([]); setLiveError(''); setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true); setLiveError('');
    const handle = setTimeout(async () => {
      try {
        const r = await lookupByText(query, settings);
        if (cancelled) return;
        const extras = r.filter((x) => x.source !== 'curated');
        setLiveResults(extras);
        if (!extras.length) setLiveError('');
      } catch {
        if (!cancelled) setLiveError("Couldn't reach live lookup. Curated results only.");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, curatedResults.length, settings]);

  const recents = useMemo(() => uniqueFoods(recentIds, 4, cachedBrands), [recentIds, cachedBrands]);
  const favourites = useMemo(() => uniqueFoods(favouriteIds, 6, cachedBrands), [favouriteIds, cachedBrands]);

  const browse = !query;
  const allResults = useMemo(() => {
    return [
      ...curatedResults.map((f) => ({ food: f, source: 'curated' })),
      ...liveResults,
    ];
  }, [curatedResults, liveResults]);

  const handleScan = async (code) => {
    setScanning(false);
    setLiveLoading(true); setLiveError('');
    try {
      const r = await lookupByBarcode(code, settings);
      if (r?.food) {
        setSelected(r.food);
        setQuery(r.food.brand + ' ' + r.food.name);
      } else {
        setLiveError(`No match for barcode ${code}.`);
      }
    } catch {
      setLiveError('Lookup failed. Try typing the brand instead.');
    } finally {
      setLiveLoading(false);
    }
  };

  const handleLog = (entry) => {
    onLogEntry?.(entry);
    setSelected(null);
    setQuery('');
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="card w-full p-4 flex items-center justify-between text-left hover:bg-white/85 transition fade-up"
        aria-label="Open brand food search">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-moss/15 text-moss flex items-center justify-center">
            <SearchIcon />
          </span>
          <div>
            <div className="font-medium text-ink">Search a brand or scan</div>
            <div className="text-xs text-muted">Weet-Bix, Chobani, Helga's, barcodes…</div>
          </div>
        </div>
        <span className="text-xs chip bg-sand/80">{BRAND_FOODS.length}+ verified</span>
      </button>
    );
  }

  return (
    <section className="card p-4 sm:p-5 fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-moss/15 text-moss flex items-center justify-center">
            <SearchIcon />
          </span>
          <div>
            <h3 className="font-display text-lg leading-tight">Brand search</h3>
            <p className="text-[11px] text-muted">Curated → Woolworths/manufacturer → Open Food Facts</p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setSelected(null); setQuery(''); }}
          className="text-muted text-xs px-2 py-1 hover:text-plum" aria-label="Close brand search">Close</button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="e.g. Chobani vanilla, Weet-Bix, Helga's…"
            className="input pr-10"
            aria-label="Search brand foods"
          />
          {query && (
            <button onClick={() => { setQuery(''); setSelected(null); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-plum w-7 h-7 rounded-full"
              aria-label="Clear">×</button>
          )}
        </div>
        <button onClick={() => setScanning(true)}
          className="shrink-0 w-12 h-12 rounded-2xl bg-moss text-cream flex items-center justify-center"
          aria-label="Scan barcode">
          <BarcodeIcon />
        </button>
      </div>

      {browse && favourites.length > 0 && (
        <Section title="Favourites">
          <div className="flex flex-wrap gap-1.5">
            {favourites.map((f) => (
              <button key={f.id} onClick={() => setSelected(f)}
                className="chip bg-rose/10 border border-rose/30 text-plum hover:bg-rose/20">
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
                className="chip bg-white/80 border border-sand hover:bg-sand">
                {f.brand} · {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {browse && (
        <Section title="Browse">
          <BrandList items={BRAND_FOODS.slice(0, 8).map((f) => ({ food: f, source: 'curated' }))}
            onSelect={setSelected} selectedId={selected?.id}/>
          <p className="text-[11px] text-muted mt-2">Showing 8 of {BRAND_FOODS.length}. Type to narrow.</p>
        </Section>
      )}

      {!browse && (
        <div className="mt-3">
          {allResults.length === 0 && !liveLoading ? (
            <div className="text-sm text-muted py-2">
              No match for "<span className="text-plum">{query}</span>". Try the voice/text logger below — or scan the pack.
            </div>
          ) : (
            <BrandList items={allResults} onSelect={setSelected} selectedId={selected?.id}/>
          )}
          {liveLoading && (
            <div className="text-[11px] text-muted mt-2 inline-flex items-center gap-2">
              <Spinner/> Looking up…
            </div>
          )}
          {liveError && <div className="text-[11px] text-rose mt-2">{liveError}</div>}
        </div>
      )}

      {selected && (
        <ServingCalculator
          food={selected}
          meal={meal}
          isFavourite={favouriteIds.includes(selected.id)}
          onToggleFav={onToggleFav}
          lastUsage={brandUsage[selected.id] || null}
          onLog={handleLog}
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

function uniqueFoods(ids, limit, cache) {
  const seen = new Set(); const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const f = findBrandFoodById(id) || cache?.[id];   // curated first, then cached live items
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

function BrandList({ items, onSelect, selectedId }) {
  return (
    <ul className="divide-y divide-sand/70">
      {items.map(({ food: f, source }) => {
        const v = validateBrandFood(f);
        const active = selectedId === f.id;
        return (
          <li key={f.id}>
            <button onClick={() => onSelect(f)}
              className={`w-full text-left py-2.5 px-2 rounded-xl flex items-center gap-3 transition ${
                active ? 'bg-moss/10' : 'hover:bg-sand/40'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-moss bg-moss/10 rounded px-1.5 py-0.5 shrink-0">
                    {f.brand}
                  </span>
                  <span className="font-medium truncate">{f.name}{f.variant ? ` · ${f.variant}` : ''}</span>
                  <SourcePill source={source}/>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {f.serving.label} · {Math.round((f.per100.kcal * f.serving.size) / 100)} kcal
                  {' · '}{Math.round((f.per100.protein * f.serving.size) / 10) / 10}g protein
                </div>
              </div>
              {!v.valid && (
                <span title={v.warnings.join(', ')}
                  className="text-[10px] bg-rose/15 text-rose px-1.5 py-0.5 rounded-full shrink-0">
                  Check
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SourcePill({ source }) {
  if (source === 'curated') return null;  // default — no pill needed
  const cfg = source === 'woolworths' ? { label: 'Woolworths', cls: 'bg-moss/10 text-moss' }
    : source === 'proxy' || source === 'manufacturer' ? { label: 'Live', cls: 'bg-clay/20 text-plum' }
    : { label: 'OFF', cls: 'bg-sand text-plum' };
  return <span className={`text-[9px] uppercase tracking-wide rounded px-1 py-0.5 ${cfg.cls}`} title={`Source: ${source}`}>{cfg.label}</span>;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
    </svg>
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
