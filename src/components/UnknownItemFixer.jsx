import { useEffect, useMemo, useState } from 'react';
import { searchFoods, nutrientsFor } from '../data/foods.js';
import { lookupByText } from '../utils/foodLookup.js';
import ServingCalculator from './ServingCalculator.jsx';

// Lets the user resolve "unknown" food items the parser couldn't match.
// Searches local generic DB instantly, plus fires the live lookup chain
// (curated brand → proxy → Open Food Facts) so brand-prefixed queries
// like "farmers union greek yoghurt" surface a real product to pick.
//
// Two resolution paths:
//   - Generic food chosen → onResolveGeneric({food, amount, unit})
//   - Brand food chosen   → ServingCalculator opens inline; onLogBrand(entry)
//                           is called when the user taps "Add to today".
export default function UnknownItemFixer({
  item, onResolveGeneric, onLogBrand, onSkip,
  settings = {}, meal = 'meal',
  favouriteIds = [], onToggleFav, brandUsage = {},
}) {
  const [q, setQ] = useState(item.query || '');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [liveResults, setLiveResults] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  const localResults = useMemo(() => searchFoods(q, 6), [q]);

  useEffect(() => {
    if (q.trim().length < 3) { setLiveResults([]); return; }
    let cancelled = false;
    setLiveLoading(true); setLiveError('');
    const handle = setTimeout(async () => {
      try {
        const r = await lookupByText(q, settings);
        if (!cancelled) setLiveResults(r);
      } catch {
        if (!cancelled) setLiveError("Live lookup unavailable.");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [q, settings]);

  const handleBrandLog = (entry) => {
    onLogBrand?.(entry);
  };

  return (
    <div className="card p-4 fade-up">
      <div className="text-sm text-plum mb-2">
        Couldn't match <span className="font-medium">"{item.query}"</span>. Pick the closest:
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setSelectedBrand(null); }}
        className="input mb-3" placeholder="Search foods or brands…"/>

      {liveLoading && (
        <div className="text-[11px] text-muted mb-2">Looking up Woolworths / Open Food Facts…</div>
      )}
      {liveError && <div className="text-[11px] text-rose mb-2">{liveError}</div>}

      {liveResults.length > 0 && !selectedBrand && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Brand matches</div>
          <ul className="divide-y divide-sand/70">
            {liveResults.map(({ food, source }) => (
              <li key={food.id}>
                <button onClick={() => setSelectedBrand(food)}
                  className="w-full text-left py-2 px-2 rounded-xl hover:bg-sand/40 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-moss bg-moss/10 rounded px-1.5 py-0.5 shrink-0">
                    {food.brand}
                  </span>
                  <span className="font-medium truncate flex-1">
                    {food.name}{food.variant ? ` · ${food.variant}` : ''}
                  </span>
                  <SourcePill source={source}/>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedBrand && (
        <ServingCalculator
          food={selectedBrand}
          meal={meal}
          isFavourite={favouriteIds.includes(selectedBrand.id)}
          onToggleFav={onToggleFav}
          lastUsage={brandUsage[selectedBrand.id] || null}
          onLog={handleBrandLog}
        />
      )}

      {!selectedBrand && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Generic foods</div>
          {localResults.length === 0 ? (
            <div className="text-xs text-muted italic py-1">Nothing in the generic database matches that.</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {localResults.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => onResolveGeneric({ food: f, amount: f.unit==='piece' ? 1 : f.per, unit: f.unit==='piece' ? 'piece' : f.unit })}
                    className="w-full text-left text-sm px-3 py-2 rounded-xl bg-sand/60 hover:bg-sand"
                  >
                    {f.name} <span className="text-muted text-xs">— {f.kcal} kcal/{f.unit==='piece' ? 'piece' : f.per+f.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <button onClick={onSkip} className="btn-ghost text-sm">Skip</button>
      </div>
    </div>
  );
}

function SourcePill({ source }) {
  if (source === 'curated') return <span className="text-[9px] uppercase tracking-wide rounded px-1 py-0.5 bg-moss/10 text-moss">Curated</span>;
  if (source === 'woolworths' || source === 'proxy' || source === 'manufacturer')
    return <span className="text-[9px] uppercase tracking-wide rounded px-1 py-0.5 bg-clay/20 text-plum">Live</span>;
  return <span className="text-[9px] uppercase tracking-wide rounded px-1 py-0.5 bg-sand text-plum">OFF</span>;
}
