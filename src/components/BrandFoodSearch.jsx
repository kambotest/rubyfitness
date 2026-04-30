import { useEffect, useMemo, useRef, useState } from 'react';
import { searchBrandFoods, findBrandFoodById, BRAND_FOODS, validateBrandFood } from '../utils/brandFoods.js';
import ServingCalculator from './ServingCalculator.jsx';

// Brand-specific food search for the homepage. Sits above the voice input and
// is collapsed by default so it doesn't crowd the primary mic-first flow.
//
// Props:
//   onLogEntry(entry) — called with a food-entry shape (kcal/protein/...)
//                       ready to be appended to state.foodEntries
//   meal              — current meal slot
//   recentIds         — array of brandFoodIds the user has recently logged
export default function BrandFoodSearch({ onLogEntry, meal, recentIds = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useMemo(() => searchBrandFoods(query, 10), [query]);

  const recents = useMemo(() => {
    const seen = new Set();
    return recentIds.map((id) => findBrandFoodById(id))
      .filter((f) => { if (!f || seen.has(f.id)) return false; seen.add(f.id); return true; })
      .slice(0, 4);
  }, [recentIds]);

  const browse = !query;

  const handleLog = (entry) => {
    onLogEntry?.(entry);
    setSelected(null);
    setQuery('');
    // keep panel open so the user can log a second item
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
            <div className="font-medium text-ink">Search a brand</div>
            <div className="text-xs text-muted">Weet-Bix, Chobani, Helga's… NIP-accurate macros</div>
          </div>
        </div>
        <span className="text-xs chip bg-sand/80">{BRAND_FOODS.length} verified</span>
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
            <p className="text-[11px] text-muted">Sourced from manufacturer NIPs · cross-checked at Woolworths</p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setSelected(null); setQuery(''); }}
          className="text-muted text-xs px-2 py-1 hover:text-plum" aria-label="Close brand search">Close</button>
      </div>

      <div className="relative">
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

      {browse && recents.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Recent</div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((f) => (
              <button key={f.id} onClick={() => setSelected(f)}
                className="chip bg-white/80 border border-sand hover:bg-sand">
                {f.brand} · {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {browse && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Browse</div>
          <BrandList foods={BRAND_FOODS.slice(0, 8)} onSelect={setSelected} selectedId={selected?.id} />
          <p className="text-[11px] text-muted mt-2">Showing 8 of {BRAND_FOODS.length}. Type to narrow.</p>
        </div>
      )}

      {!browse && (
        <div className="mt-3">
          {results.length === 0 ? (
            <div className="text-sm text-muted py-2">
              No brand match for "<span className="text-plum">{query}</span>". Try the voice/text logger below — it uses the generic database.
            </div>
          ) : (
            <BrandList foods={results} onSelect={setSelected} selectedId={selected?.id} />
          )}
        </div>
      )}

      {selected && (
        <ServingCalculator
          food={selected}
          meal={meal}
          onLog={handleLog}
        />
      )}
    </section>
  );
}

function BrandList({ foods, onSelect, selectedId }) {
  return (
    <ul className="divide-y divide-sand/70">
      {foods.map((f) => {
        const v = validateBrandFood(f);
        const active = selectedId === f.id;
        return (
          <li key={f.id}>
            <button onClick={() => onSelect(f)}
              className={`w-full text-left py-2.5 px-2 rounded-xl flex items-center gap-3 transition ${
                active ? 'bg-moss/10' : 'hover:bg-sand/40'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-moss bg-moss/10 rounded px-1.5 py-0.5 shrink-0">
                    {f.brand}
                  </span>
                  <span className="font-medium truncate">{f.name}{f.variant ? ` · ${f.variant}` : ''}</span>
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
    </svg>
  );
}
