import { useState } from 'react';
import { searchFoods, nutrientsFor } from '../data/foods.js';

// Lets the user resolve "unknown" food items the parser couldn't match.
export default function UnknownItemFixer({ item, onResolve, onSkip }) {
  const [q, setQ] = useState(item.query || '');
  const results = searchFoods(q, 6);
  return (
    <div className="card p-4 fade-up">
      <div className="text-sm text-plum mb-2">
        Couldn't match <span className="font-medium">"{item.query}"</span>. Pick the closest:
      </div>
      <input value={q} onChange={(e)=>setQ(e.target.value)} className="input mb-2" placeholder="Search foods…"/>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {results.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onResolve({ food: f, amount: f.unit==='piece' ? 1 : f.per, unit: f.unit==='piece' ? 'piece' : f.unit })}
              className="w-full text-left text-sm px-3 py-2 rounded-xl bg-sand/60 hover:bg-sand"
            >
              {f.name} <span className="text-muted text-xs">— {f.kcal} kcal/{f.unit==='piece' ? 'piece' : f.per+f.unit}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-end">
        <button onClick={onSkip} className="btn-ghost text-sm">Skip</button>
      </div>
    </div>
  );
}
