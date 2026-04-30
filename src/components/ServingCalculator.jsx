import { useMemo, useState } from 'react';
import { calcMacros, validateBrandFood } from '../utils/brandFoods.js';

// Live macros for a brand food. Three input modes (serving / grams / pack)
// modelled on the MyFitnessPal pattern: choose unit, type or step amount,
// macros recalculate instantly.
//
// Props:
//   food         — brand-food object
//   onLog(entry) — called when user taps "Add to today" (entry is the
//                  food-entry shape compatible with state.foodEntries)
//   meal         — current meal slot (breakfast/lunch/...) supplied by parent
export default function ServingCalculator({ food, onLog, meal = 'meal' }) {
  const measureUnit = food.serving.unit; // 'g' or 'ml'
  const [mode, setMode] = useState('serving');
  const [amount, setAmount] = useState(1);

  const macros = useMemo(() => calcMacros(food, amount, mode), [food, amount, mode]);
  const qa = useMemo(() => validateBrandFood(food), [food]);

  const step = (delta) => {
    const min = mode === 'serving' || mode === 'package' ? 0.25 : 1;
    setAmount((a) => Math.max(0, Math.round((Number(a) + delta) * 100) / 100) || min);
  };

  const stepSize = mode === 'serving' || mode === 'package' ? 0.5 : 10;

  const log = () => {
    if (!macros.grams) return;
    const label = food.variant ? `${food.brand} ${food.name} (${food.variant})` : `${food.brand} ${food.name}`;
    onLog?.({
      foodId: food.id,
      brandFoodId: food.id,           // dedicated key so we can re-resolve later
      group: food.group,              // mirrors generic foods so variety bars work
      name: label,
      amount: macros.grams,
      unit: measureUnit,              // 'g' or 'ml' — matches existing entry schema
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      sodium: macros.sodium,
      sugars: macros.sugars,
      satFat: macros.satFat,
      meal,
      raw: `Brand search · ${displayAmount(amount, mode, food)}`,
    });
  };

  return (
    <div className="mt-3 rounded-2xl border border-sand bg-cream/60 p-4 fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="chip bg-moss/15 text-moss">{food.brand}</span>
            <h4 className="font-display text-lg leading-tight truncate">
              {food.name}{food.variant ? ` · ${food.variant}` : ''}
            </h4>
          </div>
          <div className="text-xs text-muted mt-1">
            Per 100 {measureUnit}: {food.per100.kcal} kcal · {food.per100.protein}p · {food.per100.carbs}c · {food.per100.fat}f
          </div>
        </div>
        <QABadge qa={food.qa} runtime={qa} source={food.source} />
      </div>

      <div className="flex gap-1.5 mb-3">
        <ModeBtn id="serving" current={mode} setMode={setMode}>Serving</ModeBtn>
        <ModeBtn id={measureUnit} current={mode} setMode={setMode}>{measureUnit === 'g' ? 'Grams' : 'mL'}</ModeBtn>
        <ModeBtn id="package" current={mode} setMode={setMode}>Pack</ModeBtn>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => step(-stepSize)} aria-label="Decrease"
          className="w-10 h-10 rounded-full bg-white border border-sand text-plum text-lg active:scale-95">−</button>
        <div className="flex-1 relative">
          <input
            type="number" inputMode="decimal" min="0" step={stepSize}
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => { if (amount === '' || Number(amount) <= 0) setAmount(stepSize); }}
            className="input text-center text-lg pr-16"
            aria-label="Amount"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
            {unitLabel(mode, food, amount)}
          </span>
        </div>
        <button onClick={() => step(stepSize)} aria-label="Increase"
          className="w-10 h-10 rounded-full bg-white border border-sand text-plum text-lg active:scale-95">+</button>
      </div>

      <div className="text-xs text-muted mt-2">
        ≈ {macros.grams} {measureUnit} · {food.serving.label}
        {mode === 'package' && ` · pack is ${food.package.size} ${food.package.unit}`}
      </div>

      <MacroPanel macros={macros} />

      {qa.warnings.length > 0 && (
        <div className="mt-3 text-[11px] text-rose bg-rose/10 rounded-xl px-3 py-2">
          Data check: {qa.warnings.join(' · ')}. Cross-check via the source link before logging.
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <a href={food.source.url} target="_blank" rel="noreferrer noopener"
          className="text-[11px] text-muted underline hover:text-plum">
          Source · {food.source.primary === 'woolworths' ? 'Woolworths' : 'Manufacturer'}
        </a>
        <button onClick={log} className="btn-primary text-sm h-10 px-5">
          Add to today
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ id, current, setMode, children }) {
  const active = current === id;
  return (
    <button onClick={() => setMode(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active ? 'bg-moss text-cream border-moss' : 'bg-white/70 text-plum border-sand hover:bg-sand/40'
      }`}>
      {children}
    </button>
  );
}

function MacroPanel({ macros }) {
  const cells = [
    { label: 'kcal',   value: macros.kcal,    accent: true },
    { label: 'Protein', value: `${macros.protein}g` },
    { label: 'Carbs',   value: `${macros.carbs}g`, sub: macros.sugars > 0 ? `${macros.sugars}g sugar` : null },
    { label: 'Fat',     value: `${macros.fat}g`,   sub: macros.satFat > 0 ? `${macros.satFat}g sat` : null },
    { label: 'Fibre',   value: `${macros.fiber}g` },
    { label: 'Sodium',  value: `${macros.sodium}mg` },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {cells.map((c) => (
        <div key={c.label}
          className={`rounded-xl px-2.5 py-2 text-center ${c.accent ? 'bg-moss text-cream' : 'bg-white/80 border border-sand'}`}>
          <div className={`text-[10px] uppercase tracking-wide ${c.accent ? 'text-cream/80' : 'text-muted'}`}>{c.label}</div>
          <div className={`font-display ${c.accent ? 'text-xl' : 'text-base text-ink'}`}>{c.value}</div>
          {c.sub && <div className="text-[10px] text-muted mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function QABadge({ qa, runtime, source }) {
  const bad = !runtime.valid;
  const conf = qa?.confidence || 'low';
  const tone = bad ? 'bg-rose/15 text-rose' :
    conf === 'high' ? 'bg-moss/15 text-moss' :
    conf === 'medium' ? 'bg-clay/20 text-plum' : 'bg-sand text-plum';
  const cross = qa?.cross || [];
  const tip = bad
    ? `Validation: ${runtime.warnings.join(', ')}`
    : `Verified ${qa?.verifiedAt || ''} · ${cross.join(' + ') || source?.primary || 'manufacturer'}`;
  return (
    <span title={tip} className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${tone}`}>
      <Tick bad={bad} />
      {bad ? 'Check' : conf === 'high' ? 'QA verified' : conf === 'medium' ? 'QA partial' : 'QA seed'}
    </span>
  );
}

function Tick({ bad }) {
  return bad ? (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M12 8v5"/><circle cx="12" cy="17" r="0.5"/>
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4 10-10"/>
    </svg>
  );
}

function unitLabel(mode, food, amount) {
  if (mode === 'serving') return Number(amount) === 1 ? 'serve' : 'serves';
  if (mode === 'package') return Number(amount) === 1 ? 'pack' : 'packs';
  return mode;
}

function displayAmount(amount, mode, food) {
  if (mode === 'serving') return `${amount} ${unitLabel(mode, food, amount)}`;
  if (mode === 'package') return `${amount} ${unitLabel(mode, food, amount)} (${amount * food.package.size} ${food.package.unit})`;
  return `${amount} ${mode}`;
}
