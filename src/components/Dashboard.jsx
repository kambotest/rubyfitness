import { useMemo, useRef, useState } from 'react';
import VoiceInput from './VoiceInput.jsx';
import BrandFoodSearch from './BrandFoodSearch.jsx';
import Ring from './Rings.jsx';
import { FoodEntryList, ExerciseEntryList } from './EntryList.jsx';
import UnknownItemFixer from './UnknownItemFixer.jsx';
import EntryEditor from './EntryEditor.jsx';
import PhotoMealCapture, { compressPhoto } from './PhotoMealCapture.jsx';
import {
  parseFoodTranscript, parseExerciseTranscript, classifyTranscript,
} from '../utils/parser.js';
import { findFood, nutrientsFor } from '../data/foods.js';
import { findBrandFoodById } from '../utils/brandFoods.js';
import { aggregatePlants, plantsForEntry } from '../data/plants.js';
import { todayISO, newId, isoDaysAgo, dailyCalorieTarget, macroTargets } from '../utils/storage.js';

function currentMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

export default function Dashboard({ state, setState }) {
  const [pending, setPending] = useState([]);    // unresolved unknown items
  const [mode, setMode] = useState('auto');      // 'auto'|'food'|'exercise'
  const [date, setDate] = useState(todayISO());
  const [editingEntry, setEditingEntry] = useState(null);
  const [photoEntry, setPhotoEntry] = useState(null);
  const photoFileRef = useRef(null);

  const dayFood = useMemo(
    () => state.foodEntries.filter((e) => e.date === date),
    [state.foodEntries, date]
  );
  const dayEx = useMemo(
    () => state.exerciseEntries.filter((e) => e.date === date),
    [state.exerciseEntries, date]
  );

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0 };
    dayFood.forEach((e) => {
      t.kcal += e.kcal; t.protein += e.protein; t.carbs += e.carbs;
      t.fat += e.fat; t.fiber += e.fiber;
      t.sugars += (e.sugars || 0);
    });
    return t;
  }, [dayFood]);
  const burned = useMemo(() => dayEx.reduce((s,e) => s + e.kcal, 0), [dayEx]);

  const target = dailyCalorieTarget(state.profile, state.goals);
  const macros = macroTargets(state.profile, state.goals);
  const proteinT = macros.protein;
  const fiberT   = macros.fiber;
  const sugarT   = macros.sugar;

  const submit = (text) => {
    const cls = mode === 'auto' ? classifyTranscript(text) : mode;
    if (cls === 'exercise') {
      const ex = parseExerciseTranscript(text, state.profile.weightKg);
      if (ex && !ex.unknown) {
        const entry = { id: newId(), date, ...ex };
        setState({ ...state, exerciseEntries: [...state.exerciseEntries, entry] });
      } else {
        // route to food parsing as fallback
        addFoods(text);
      }
    } else {
      addFoods(text);
    }
  };

  const addFoods = (text) => {
    const items = parseFoodTranscript(text);
    if (!items.length) return;
    const meal = currentMeal();
    const ok = items.filter((i) => !i.unknown).map((i) => ({ id: newId(), date, meal, ...i }));
    const unk = items.filter((i) => i.unknown).map((i) => ({ ...i, _id: newId() }));
    if (ok.length) {
      setState((s) => ({ ...s, foodEntries: [...s.foodEntries, ...ok] }));
    }
    if (unk.length) setPending((p) => [...p, ...unk]);
  };

  const resolveUnknown = (pendingItem, { food, amount, unit }) => {
    const macros = nutrientsFor(food, amount, unit);
    const entry = {
      id: newId(), date, meal: currentMeal(),
      foodId: food.id, name: food.name, amount, unit,
      ...macros, raw: pendingItem.raw,
    };
    setState((s) => ({ ...s, foodEntries: [...s.foodEntries, entry] }));
    setPending((p) => p.filter((x) => x._id !== pendingItem._id));
  };

  const resolveUnknownBrand = (pendingItem, brandEntry) => {
    logBrand({ ...brandEntry, raw: pendingItem.raw });
    setPending((p) => p.filter((x) => x._id !== pendingItem._id));
  };

  const removeFood = (id) =>
    setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) }));
  const removeEx = (id) =>
    setState((s) => ({ ...s, exerciseEntries: s.exerciseEntries.filter((e) => e.id !== id) }));

  const updateFood = (updated) => {
    setState((s) => ({
      ...s,
      foodEntries: s.foodEntries.map((e) => (e.id === updated.id ? updated : e)),
    }));
    setEditingEntry(null);
  };

  // Photo-meal "snap now, fill later" pipeline.
  const handlePhotoCapture = async (file) => {
    if (!file) return;
    const dataUrl = await compressPhoto(file, 720, 0.72);
    if (!dataUrl) return;
    const photoId = newId();
    const entryId = newId();
    setState((s) => ({
      ...s,
      photoMeals: { ...(s.photoMeals || {}), [photoId]: { dataUrl, capturedAt: Date.now() } },
      foodEntries: [...s.foodEntries, {
        id: entryId, date, meal: currentMeal(),
        name: 'Photo meal · macros pending',
        amount: 0, unit: 'g',
        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0,
        photoId, needsMacros: true,
        raw: 'Photo meal',
      }],
    }));
  };

  const resolvePhotoMeal = (entry, item) => {
    setState((s) => {
      const photoMeals = { ...(s.photoMeals || {}) };
      delete photoMeals[entry.photoId];
      return {
        ...s,
        photoMeals,
        foodEntries: s.foodEntries.map((e) => (e.id === entry.id ? {
          ...e,
          name: item.name,
          amount: item.amount, unit: item.unit,
          kcal: item.kcal, protein: item.protein, carbs: item.carbs,
          fat: item.fat, fiber: item.fiber, sugars: item.sugars,
          group: item.group,
          brandFoodId: item.brandFoodId,
          foodId: item.foodId,
          needsMacros: false,
          photoId: undefined,
        } : e)),
      };
    });
    setPhotoEntry(null);
  };

  // Manual plant entry — for plants that aren't in the food database yet
  // (e.g. "yellow dragonfruit"). Stored as a zero-macro entry tagged with
  // manualPlants so plantsForEntry() picks it up in the weekly tally.
  const addManualPlant = (plantName) => {
    const name = plantName.trim().toLowerCase();
    if (!name) return;
    const entry = {
      id: newId(), date, meal: 'snack',
      name: name[0].toUpperCase() + name.slice(1),
      amount: 1, unit: 'piece',
      kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0,
      manualPlants: [name],
      raw: `Manual plant entry: ${name}`,
    };
    setState((s) => ({ ...s, foodEntries: [...s.foodEntries, entry] }));
  };

  const logBrand = (entry) => {
    const { _usage, _food, ...rest } = entry;
    const full = { id: newId(), date, ...rest, meal: rest.meal || currentMeal() };
    setState((s) => {
      const usage = { ...(s.brandUsage || {}) };
      if (rest.brandFoodId && _usage) {
        const prev = usage[rest.brandFoodId] || { count: 0 };
        usage[rest.brandFoodId] = {
          ..._usage,
          count: (prev.count || 0) + 1,
          lastDate: todayISO(),
        };
      }
      // Cache live (non-curated) brand foods so future searches resolve
      // instantly and the item works offline.
      const cache = { ...(s.cachedBrands || {}) };
      if (_food && rest.brandFoodId && !findBrandFoodById(rest.brandFoodId)) {
        cache[rest.brandFoodId] = _food;
      }
      return { ...s, foodEntries: [...s.foodEntries, full], brandUsage: usage, cachedBrands: cache };
    });
  };

  const toggleFavourite = (id, food) => {
    setState((s) => {
      const cur = s.favouriteBrands || [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      const cache = { ...(s.cachedBrands || {}) };
      if (food && !findBrandFoodById(id) && !cache[id]) cache[id] = food;
      return { ...s, favouriteBrands: next, cachedBrands: cache };
    });
  };

  const recentBrandIds = useMemo(() => {
    const ids = [];
    for (let i = state.foodEntries.length - 1; i >= 0 && ids.length < 8; i--) {
      const id = state.foodEntries[i].brandFoodId;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [state.foodEntries]);

  const remaining = Math.max(0, target - totals.kcal + burned);
  const weekPlants = useMemo(() => {
    const start = isoDaysAgo(6);
    const weekEntries = state.foodEntries.filter((e) => e.date >= start && e.date <= date);
    return aggregatePlants(weekEntries);
  }, [state.foodEntries, date]);
  const plantsTarget = state.goals.plantsPerWeek || 50;

  return (
    <div className="space-y-5">
      <Header state={state} date={date} setDate={setDate} />

      <BrandFoodSearch
        onLogEntry={logBrand}
        meal={currentMeal()}
        recentIds={recentBrandIds}
        favouriteIds={state.favouriteBrands || []}
        onToggleFav={toggleFavourite}
        brandUsage={state.brandUsage || {}}
        cachedBrands={state.cachedBrands || {}}
        settings={state.settings || {}}
      />

      <VoiceInput onSubmit={submit} placeholder={
        mode === 'exercise'
          ? 'e.g. "ran 5km in 32 minutes", "45 min walk"'
          : 'e.g. "150g chicken, 1 cup rice, half an avocado"'
      } />

      <div className="flex gap-2">
        {['auto','food','exercise'].map((m) => (
          <button key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${mode===m ? 'bg-moss text-cream border-moss' : 'bg-white/60 text-plum border-sand'}`}
          >
            {m === 'auto' ? 'Smart' : m === 'food' ? 'Food only' : 'Exercise only'}
          </button>
        ))}
      </div>

      {pending.map((p) => (
        <UnknownItemFixer key={p._id}
          item={p}
          onResolveGeneric={(payload) => resolveUnknown(p, payload)}
          onLogBrand={(entry) => resolveUnknownBrand(p, entry)}
          onSkip={() => setPending((arr) => arr.filter((x) => x._id !== p._id))}
          settings={state.settings || {}}
          meal={currentMeal()}
          favouriteIds={state.favouriteBrands || []}
          onToggleFav={toggleFavourite}
          brandUsage={state.brandUsage || {}}
        />
      ))}

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl">Today</h2>
            <p className="text-xs text-muted">{prettyDate(date)}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">Remaining</div>
            <div className="font-display text-2xl text-moss">{remaining}<span className="text-sm text-muted"> kcal</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          <Ring size={88} value={totals.kcal}    target={target}   label="Calories" sub={`${burned} burned`} color="#5E7257"/>
          <Ring size={88} value={totals.protein} target={proteinT} label="Protein"  sub="g" color="#6B4F60"/>
          <Ring size={88} value={totals.fiber}   target={fiberT}   label="Fibre"    sub="g" color="#C9A98C"/>
          <Ring size={88}
            value={Math.round(totals.sugars * 10) / 10}
            target={sugarT}
            label="Sugar"
            sub={`/ ${sugarT}g cap`}
            color={totals.sugars >= sugarT ? '#C97B6B' : '#D9A6A1'}
          />
          <Ring size={88} value={weekPlants.plants.length} target={plantsTarget}
            label="Plants" sub="this week" color="#8FA487"/>
        </div>
      </section>

      <PlantsCard
        weekPlants={weekPlants}
        target={plantsTarget}
        onAddManual={(plantName) => addManualPlant(plantName)}
      />

      <section className="grid sm:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-lg">Eaten</h3>
            <input ref={photoFileRef} type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={(e) => { handlePhotoCapture(e.target.files?.[0]); e.target.value = ''; }}/>
            <button onClick={() => photoFileRef.current?.click()}
              className="btn-soft text-xs h-8 px-3 inline-flex items-center gap-1.5"
              aria-label="Snap meal photo">
              <CameraIcon/> Snap meal
            </button>
          </div>
          <FoodEntryList entries={dayFood} onDelete={removeFood}
            onEdit={(e) => e.needsMacros ? setPhotoEntry(e) : setEditingEntry(e)} />
        </div>
        <div className="card p-5">
          <h3 className="font-display text-lg mb-2">Movement</h3>
          <ExerciseEntryList entries={dayEx} onDelete={removeEx} />
        </div>
      </section>

      {editingEntry && (
        <EntryEditor
          entry={editingEntry}
          cachedBrands={state.cachedBrands || {}}
          onSave={updateFood}
          onDelete={() => { removeFood(editingEntry.id); setEditingEntry(null); }}
          onClose={() => setEditingEntry(null)}
        />
      )}
      {photoEntry && (
        <PhotoMealCapture
          entry={photoEntry}
          photoMeals={state.photoMeals || {}}
          onResolve={resolvePhotoMeal}
          onClose={() => setPhotoEntry(null)}
        />
      )}
    </div>
  );
}

function Header({ state, date, setDate }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">{prettyDate(date)}</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">
          {state.profile.name ? `${state.profile.name}'s log` : "Today's log"}
        </h1>
      </div>
      <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
        className="bg-white/70 border border-sand rounded-xl px-3 py-2 text-sm" />
    </div>
  );
}

function prettyDate(iso) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <circle cx="12" cy="13" r="3.5"/>
    </svg>
  );
}

function PlantsCard({ weekPlants, target, onAddManual }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const count = weekPlants.plants.length;
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onAddManual?.(v);
    setDraft(''); setAdding(false);
  };
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-lg">Plants this week</h3>
          <p className="text-xs text-muted">Distinct plant species over the last 7 days</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-moss">{count}<span className="text-sm text-muted"> / {target}</span></div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-sand overflow-hidden mb-3">
        <div className="h-full bg-sage" style={{ width: `${Math.min(100, (count / target) * 100)}%` }}/>
      </div>

      {count === 0 ? (
        <p className="text-sm text-muted">No plants logged in the last 7 days.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {weekPlants.plants.map((p) => (
            <span key={p} className="chip bg-sage/15 text-moss border border-sage/30">
              {p}{weekPlants.byPlant[p] > 1 && <span className="text-muted ml-1">×{weekPlants.byPlant[p]}</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="btn-soft text-xs">+ Add plant manually</button>
        ) : (
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
              autoFocus
              placeholder="e.g. yellow dragonfruit, kohlrabi…"
              className="input flex-1 text-sm"/>
            <button onClick={submit} disabled={!draft.trim()} className="btn-primary text-sm">Add</button>
            <button onClick={() => { setAdding(false); setDraft(''); }} className="btn-ghost text-sm">Cancel</button>
          </div>
        )}
      </div>
    </section>
  );
}
