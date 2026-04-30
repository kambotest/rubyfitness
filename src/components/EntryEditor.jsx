import { useEffect, useMemo, useState } from 'react';
import { findFood, nutrientsFor } from '../data/foods.js';
import { findBrandFoodById, calcMacros } from '../utils/brandFoods.js';

// Edit a logged food entry: change amount / unit / meal slot, see live
// macro changes, save or delete. Works for both generic foods (looked up
// by name) and brand foods (looked up by brandFoodId, with serving / grams
// / pack mode toggle and the same calculator math used at log time).
export default function EntryEditor({
  entry, onSave, onDelete, onClose, cachedBrands = {},
}) {
  const isBrand = !!entry.brandFoodId;
  const brandFood = isBrand ? (findBrandFoodById(entry.brandFoodId) || cachedBrands[entry.brandFoodId]) : null;
  const genericFood = !isBrand ? findFood(entry.name) : null;

  // Initialise editor state from the entry. For brand foods we default to
  // grams (entry.unit is always 'g' or 'ml' for brands) so the user can
  // tweak without first guessing the original mode.
  const [mode, setMode] = useState(isBrand ? entry.unit : entry.unit);
  const [amount, setAmount] = useState(entry.amount);
  const [meal, setMeal] = useState(entry.meal || 'meal');

  useEffect(() => {
    setMode(entry.unit);
    setAmount(entry.amount);
    setMeal(entry.meal || 'meal');
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute macros live as the user adjusts.
  const recomputed = useMemo(() => {
    if (!Number.isFinite(Number(amount)) || amount === '' || amount <= 0) return null;
    if (isBrand && brandFood) return calcMacros(brandFood, Number(amount), mode);
    if (!isBrand && genericFood) {
      const m = nutrientsFor(genericFood, Number(amount), mode || genericFood.unit);
      return { ...m, grams: Number(amount) };
    }
    return null;
  }, [amount, mode, brandFood, genericFood, isBrand]);

  const stepSize = mode === 'serving' || mode === 'package' ? 0.5 : (mode === 'piece' ? 1 : 10);

  const save = () => {
    if (!recomputed) return;
    const updated = { ...entry };
    if (isBrand && brandFood) {
      // For brand foods we always store grams/ml + macros; the mode is
      // a UI concept that translates to grams via calcMacros.
      updated.amount = recomputed.grams;
      updated.unit = brandFood.serving.unit;
      updated.kcal = recomputed.kcal;
      updated.protein = recomputed.protein;
      updated.carbs = recomputed.carbs;
      updated.fat = recomputed.fat;
      updated.fiber = recomputed.fiber;
      updated.sugars = recomputed.sugars;
      updated.satFat = recomputed.satFat;
      updated.sodium = recomputed.sodium;
    } else if (genericFood) {
      updated.amount = Number(amount);
      updated.unit = mode;
      updated.kcal = recomputed.kcal;
      updated.protein = recomputed.protein;
      updated.carbs = recomputed.carbs;
      updated.fat = recomputed.fat;
      updated.fiber = recomputed.fiber;
      updated.sugars = recomputed.sugars;
    }
    updated.meal = meal;
    onSave?.(updated);
  };

  const cantResolve = (isBrand && !brandFood) || (!isBrand && !genericFood);

  return (
    <div className="fixed inset-0 z-50 overlay flex items-end sm:items-center justify-center p-2"
         onClick={onClose}>
      <div className="card w-full max-w-md p-4 sm:p-5 fade-up max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted">Edit log entry</p>
            <h3 className="font-display text-lg leading-tight truncate">{entry.name}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-plum text-sm" aria-label="Close">×</button>
        </div>

        {cantResolve ? (
          <div className="text-sm text-muted py-3">
            Can't reload nutrition data for this item to recalculate. You can still change the meal slot or delete it.
          </div>
        ) : (
          <>
            {isBrand && (
              <div className="flex gap-1.5 mb-3">
                <ModeBtn id="serving" current={mode} setMode={(m) => { setMode(m); setAmount(1); }}>Serving</ModeBtn>
                <ModeBtn id={brandFood.serving.unit} current={mode} setMode={(m) => { setMode(m); }}>
                  {brandFood.serving.unit === 'g' ? 'Grams' : 'mL'}
                </ModeBtn>
                <ModeBtn id="package" current={mode} setMode={(m) => { setMode(m); setAmount(1); }}>Pack</ModeBtn>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => setAmount((a) => Math.max(stepSize, Math.round((Number(a) - stepSize) * 100) / 100))}
                aria-label="Decrease"
                className="w-12 h-12 rounded-full bg-white border border-sand text-plum text-xl active:scale-95">−</button>
              <div className="flex-1 relative">
                <input type="number" inputMode="decimal" min="0" step={stepSize}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input text-center text-lg pr-16"
                  aria-label="Amount"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                  {unitLabel(mode, amount)}
                </span>
              </div>
              <button onClick={() => setAmount((a) => Math.round((Number(a) + stepSize) * 100) / 100 || stepSize)}
                aria-label="Increase"
                className="w-12 h-12 rounded-full bg-white border border-sand text-plum text-xl active:scale-95">+</button>
            </div>

            {recomputed && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Cell label="kcal" value={recomputed.kcal} accent/>
                <Cell label="Protein" value={`${recomputed.protein}g`}/>
                <Cell label="Carbs" value={`${recomputed.carbs}g`} sub={recomputed.sugars > 0 ? `${recomputed.sugars}g sugar` : null}/>
                <Cell label="Fat" value={`${recomputed.fat}g`} sub={recomputed.satFat > 0 ? `${recomputed.satFat}g sat` : null}/>
                <Cell label="Fibre" value={`${recomputed.fiber}g`}/>
                {isBrand && <Cell label="Sodium" value={`${recomputed.sodium}mg`}/>}
              </div>
            )}
          </>
        )}

        <div className="mt-3">
          <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Meal</label>
          <div className="flex gap-1.5 flex-wrap">
            {['breakfast', 'lunch', 'snack', 'dinner'].map((m) => (
              <button key={m} onClick={() => setMeal(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  meal === m ? 'bg-plum text-cream border-plum' : 'bg-white/70 text-plum border-sand'
                }`}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 gap-2">
          <button onClick={onDelete} className="btn-ghost text-rose text-sm">Delete</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={save} disabled={cantResolve}
              className="btn-primary text-sm h-10 px-5">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ id, current, setMode, children }) {
  const active = current === id;
  return (
    <button onClick={() => setMode(id)}
      className={`px-3 py-2 rounded-full text-xs font-medium border transition ${
        active ? 'bg-moss text-cream border-moss' : 'bg-white/70 text-plum border-sand'
      }`}>{children}</button>
  );
}

function Cell({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 text-center ${accent ? 'bg-moss text-cream' : 'bg-white/80 border border-sand'}`}>
      <div className={`text-[10px] uppercase tracking-wide ${accent ? 'text-cream/80' : 'text-muted'}`}>{label}</div>
      <div className={`font-display ${accent ? 'text-xl' : 'text-base text-ink'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function unitLabel(mode, amount) {
  if (mode === 'serving') return Number(amount) === 1 ? 'serve' : 'serves';
  if (mode === 'package') return Number(amount) === 1 ? 'pack' : 'packs';
  if (mode === 'piece')   return Number(amount) === 1 ? 'piece' : 'pieces';
  return mode;
}
