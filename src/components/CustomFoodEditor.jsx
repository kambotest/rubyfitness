import { useState } from 'react';
import { newId } from '../utils/storage.js';
import MicField from './MicField.jsx';

// Manually create a food. Two macro-entry modes:
//   per100  — figures are for 100 g (or 100 mL); typical for packaged
//             foods where the NIP is per-100. Optional pieceGrams lets
//             the user later log "6 of these" if it's a countable item.
//   piece   — figures are per single piece; pieceGrams is the weight of
//             that piece.
//
// Saved into state.customFoods and (optionally) logged immediately.
//
// Props:
//   initialName    — pre-fill the name field (e.g. from UnknownItemFixer)
//   onSave(food)   — saves the food without logging
//   onSaveAndLog(food) — saves the food and logs one piece/serving today
//   onClose()
const GROUPS = [
  { id: 'protein',   label: 'Protein' },
  { id: 'grain',     label: 'Grain' },
  { id: 'veg',       label: 'Vegetable' },
  { id: 'fruit',     label: 'Fruit' },
  { id: 'dairy',     label: 'Dairy' },
  { id: 'fat',       label: 'Fats / nuts / oils' },
  { id: 'legume',    label: 'Legume' },
  { id: 'snack',     label: 'Snack' },
  { id: 'beverage',  label: 'Beverage' },
  { id: 'condiment', label: 'Condiment / spread' },
  { id: 'mixed',     label: 'Mixed / prepared meal' },
];

export default function CustomFoodEditor({ initialName = '', initialFood = null, onSave, onSaveAndLog, onClose }) {
  // Editing an existing custom food: pre-fill state from it.
  const [name, setName] = useState(initialFood?.name || initialName);
  const [mode, setMode] = useState(initialFood ? (initialFood.unit === 'piece' ? 'piece' : 'per100') : 'per100');
  const [unit, setUnit] = useState(initialFood?.unit === 'ml' ? 'ml' : 'g');
  const [pieceGrams, setPieceGrams] = useState(initialFood?.pieceGrams != null ? String(initialFood.pieceGrams) : '');
  const [group, setGroup] = useState(initialFood?.group || 'mixed');
  const [k, setK] = useState({
    kcal:    initialFood?.kcal    != null ? String(initialFood.kcal)    : '',
    protein: initialFood?.protein != null ? String(initialFood.protein) : '',
    carbs:   initialFood?.carbs   != null ? String(initialFood.carbs)   : '',
    fat:     initialFood?.fat     != null ? String(initialFood.fat)     : '',
    fiber:   initialFood?.fiber   != null ? String(initialFood.fiber)   : '',
    sugars:  initialFood?.sugars  != null ? String(initialFood.sugars)  : '',
  });
  const setNum = (key) => (e) => setK({ ...k, [key]: e.target.value });
  const isEditing = !!initialFood;

  const valid = name.trim() && Number.isFinite(parseFloat(k.kcal));

  const buildFood = () => {
    const n = (v) => Math.max(0, parseFloat(v) || 0);
    const base = {
      id: initialFood?.id || ('custom_' + newId()),
      name: name.trim(),
      aliases: [name.trim().toLowerCase()],
      group,
      custom: true,
      kcal:    n(k.kcal),
      protein: n(k.protein),
      carbs:   n(k.carbs),
      fat:     n(k.fat),
      fiber:   n(k.fiber),
      sugars:  n(k.sugars),
    };
    if (mode === 'piece') {
      return {
        ...base,
        unit: 'piece',
        per: 1,
        pieceGrams: pieceGrams ? n(pieceGrams) : undefined,
      };
    }
    return {
      ...base,
      unit,                           // 'g' or 'ml'
      per: 100,
      pieceGrams: pieceGrams ? n(pieceGrams) : undefined,
    };
  };

  return (
    <div className="fixed inset-0 z-50 overlay flex items-end sm:items-center justify-center p-2"
         onClick={onClose}>
      <div className="card w-full max-w-md p-4 sm:p-5 fade-up max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">{isEditing ? 'Edit food' : 'New food'}</p>
            <h3 className="font-display text-lg leading-tight">{isEditing ? name : 'Add a custom food'}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-charcoal text-sm" aria-label="Close">×</button>
        </div>

        <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Name</label>
        <MicField value={name} onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. "Sourdough crumpets" or "Mum's lasagne"`}
          className="input mb-3"/>

        <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Category</label>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input mb-3 text-sm">
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>

        <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Macros are…</label>
        <div className="flex gap-1.5 mb-3">
          <ModeBtn id="per100" current={mode} setMode={setMode}>Per 100 {unit}</ModeBtn>
          <ModeBtn id="piece" current={mode} setMode={setMode}>Per piece</ModeBtn>
        </div>

        {mode === 'per100' && (
          <div className="flex gap-2 mb-3">
            <label className="text-xs text-muted self-center">Unit:</label>
            <button onClick={() => setUnit('g')}
              className={`px-3 py-1.5 rounded-full text-xs ${unit === 'g' ? 'bg-dusty text-canvas' : 'bg-linen text-charcoal'}`}>grams</button>
            <button onClick={() => setUnit('ml')}
              className={`px-3 py-1.5 rounded-full text-xs ${unit === 'ml' ? 'bg-dusty text-canvas' : 'bg-linen text-charcoal'}`}>millilitres</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <NumField label={mode === 'piece' ? 'kcal / piece' : `kcal / 100 ${unit}`} value={k.kcal} onChange={setNum('kcal')} required/>
          <NumField label="Protein (g)" value={k.protein} onChange={setNum('protein')} />
          <NumField label="Carbs (g)"   value={k.carbs}   onChange={setNum('carbs')} />
          <NumField label="Fat (g)"     value={k.fat}     onChange={setNum('fat')} />
          <NumField label="Fibre (g)"   value={k.fiber}   onChange={setNum('fiber')} />
          <NumField label="Sugars (g)"  value={k.sugars}  onChange={setNum('sugars')} />
        </div>

        <div className="mb-3">
          <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">
            {mode === 'piece' ? 'Weight of one piece (g, optional)' : 'Weight of one piece (g, optional — lets you log "6 of these")'}
          </label>
          <input type="number" inputMode="decimal" value={pieceGrams} onChange={(e) => setPieceGrams(e.target.value)}
            placeholder="e.g. 5"
            className="input"/>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={() => valid && onSave?.(buildFood())} disabled={!valid}
            className="btn-soft text-sm">{isEditing ? 'Save changes' : 'Save only'}</button>
          {!isEditing && (
            <button onClick={() => valid && onSaveAndLog?.(buildFood())} disabled={!valid}
              className="btn-primary text-sm">Save + log today</button>
          )}
        </div>
        {!valid && <p className="text-[11px] text-rose mt-2 text-right">Name and kcal are required.</p>}
      </div>
    </div>
  );
}

function ModeBtn({ id, current, setMode, children }) {
  const active = current === id;
  return (
    <button onClick={() => setMode(id)}
      className={`px-3 py-2 rounded-full text-xs font-medium border ${
        active ? 'bg-dusty text-canvas border-dusty' : 'bg-white/70 text-charcoal border-stone'
      }`}>{children}</button>
  );
}

function NumField({ label, value, onChange, required }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-muted mb-1">{label}{required && ' *'}</span>
      <input type="number" inputMode="decimal" min="0" step="0.1"
        value={value} onChange={onChange} className="input py-2 px-3 text-sm"/>
    </label>
  );
}
