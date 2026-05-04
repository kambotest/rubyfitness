import { useMemo, useRef, useState } from 'react';
import UnifiedFoodSearch from './UnifiedFoodSearch.jsx';
import { FoodEntryList } from './EntryList.jsx';
import EntryEditor from './EntryEditor.jsx';
import PhotoMealCapture, { compressPhoto } from './PhotoMealCapture.jsx';
import CustomFoodEditor from './CustomFoodEditor.jsx';
import UnknownItemFixer from './UnknownItemFixer.jsx';
import VoiceInput from './VoiceInput.jsx';
import { findBrandFoodById } from '../utils/brandFoods.js';
import { findFood, nutrientsFor } from '../data/foods.js';
import { todayISO, newId } from '../utils/storage.js';
import { parseFoodTranscript } from '../utils/parser.js';
import { useUndo } from './UndoToast.jsx';

// The Food tab. One unified search + the day's food log.
export default function FoodTab({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const [editingEntry, setEditingEntry] = useState(null);
  const [photoEntry, setPhotoEntry] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const photoFileRef = useRef(null);
  const { offerUndo } = useUndo();

  const dayFood = useMemo(() => state.foodEntries.filter((e) => e.date === date), [state.foodEntries, date]);

  const recentBrandIds = useMemo(() => {
    const ids = [];
    for (let i = state.foodEntries.length - 1; i >= 0 && ids.length < 8; i--) {
      const id = state.foodEntries[i].brandFoodId;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [state.foodEntries]);

  const logBrand = (entry) => {
    const { _usage, _food, ...rest } = entry;
    const full = { id: newId(), date, ...rest, meal: rest.meal || mealNow() };
    setState((s) => {
      const usage = { ...(s.brandUsage || {}) };
      if (rest.brandFoodId && _usage) {
        const prev = usage[rest.brandFoodId] || { count: 0 };
        usage[rest.brandFoodId] = { ..._usage, count: (prev.count || 0) + 1, lastDate: todayISO() };
      }
      const cache = { ...(s.cachedBrands || {}) };
      if (_food && rest.brandFoodId && !findBrandFoodById(rest.brandFoodId)) cache[rest.brandFoodId] = _food;
      return { ...s, foodEntries: [...s.foodEntries, full], brandUsage: usage, cachedBrands: cache };
    });
    offerUndo(`Logged ${rest.name}`, () => {
      setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== full.id) }));
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

  const removeFood = (id) => {
    let removed;
    setState((s) => {
      removed = s.foodEntries.find((e) => e.id === id);
      return { ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) };
    });
    if (removed) offerUndo(`Removed ${removed.name}`, () => {
      setState((s) => ({ ...s, foodEntries: [...s.foodEntries, removed] }));
    });
  };

  const updateFood = (updated) => {
    setState((s) => ({ ...s, foodEntries: s.foodEntries.map((e) => (e.id === updated.id ? updated : e)) }));
    setEditingEntry(null);
  };

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
        id: entryId, date, meal: mealNow(),
        name: 'Photo meal · macros pending',
        amount: 0, unit: 'g',
        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, freeSugars: 0,
        photoId, needsMacros: true, raw: 'Photo meal',
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
          name: item.name, amount: item.amount, unit: item.unit,
          kcal: item.kcal, protein: item.protein, carbs: item.carbs,
          fat: item.fat, fiber: item.fiber, sugars: item.sugars, freeSugars: item.freeSugars,
          group: item.group, brandFoodId: item.brandFoodId, foodId: item.foodId,
          needsMacros: false, photoId: undefined,
        } : e)),
      };
    });
    setPhotoEntry(null);
  };

  // Voice/text path that runs through the parser, splitting multi-item
  // utterances and routing unknowns to the picker.
  const submitText = (text) => {
    const items = parseFoodTranscript(text);
    if (!items.length) return;
    const meal = mealNow();
    const ok = items.filter((i) => !i.unknown).map((i) => ({ id: newId(), date, meal, ...i }));
    const unk = items.filter((i) => i.unknown).map((i) => ({ ...i, _id: newId() }));
    if (ok.length) {
      setState((s) => ({ ...s, foodEntries: [...s.foodEntries, ...ok] }));
      offerUndo(
        ok.length === 1 ? `Logged ${ok[0].name}` : `Logged ${ok.length} items`,
        () => setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => !ok.some((x) => x.id === e.id)) }))
      );
    }
    if (unk.length) setPending((p) => [...p, ...unk]);
  };

  const resolveUnknown = (pendingItem, { food, amount, unit }) => {
    const macros = nutrientsFor(food, amount, unit);
    const entry = {
      id: newId(), date, meal: mealNow(),
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
  const saveCustomFood = (food) => {
    setState((s) => ({ ...s, customFoods: [...(s.customFoods || []), food] }));
  };
  const saveCustomFoodAndLog = (pendingItem, food) => {
    saveCustomFood(food);
    const amount = food.unit === 'piece' ? 1 : food.per;
    const macros = nutrientsFor(food, amount, food.unit);
    setState((s) => ({
      ...s,
      foodEntries: [...s.foodEntries, {
        id: newId(), date, meal: mealNow(),
        foodId: food.id, name: food.name, amount, unit: food.unit, ...macros, group: food.group,
        raw: pendingItem ? pendingItem.raw : food.name,
      }],
    }));
    if (pendingItem) setPending((p) => p.filter((x) => x._id !== pendingItem._id));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-0.5">{prettyDate(date)}</p>
          <h1 className="font-display text-2xl text-chocolate leading-tight">Food log</h1>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-white border border-stone rounded-md px-3 py-2 text-sm" />
      </div>

      {/* Unified search */}
      <UnifiedFoodSearch
        onLogEntry={logBrand}
        meal={mealNow()}
        recentIds={recentBrandIds}
        favouriteIds={state.favouriteBrands || []}
        onToggleFav={toggleFavourite}
        brandUsage={state.brandUsage || {}}
        cachedBrands={state.cachedBrands || {}}
        settings={state.settings || {}}
      />

      {/* Voice/text dictation for multi-item shorthand */}
      <VoiceInput onSubmit={submitText}
        placeholder='Or dictate a whole meal — e.g. "2 eggs on toast, half a banana, a coffee"' />

      {pending.map((p) => (
        <UnknownItemFixer key={p._id}
          item={p}
          onResolveGeneric={(payload) => resolveUnknown(p, payload)}
          onLogBrand={(entry) => resolveUnknownBrand(p, entry)}
          onSaveCustomFood={(food) => { saveCustomFood(food); setPending((arr) => arr.filter((x) => x._id !== p._id)); }}
          onSaveAndLogCustomFood={(food) => saveCustomFoodAndLog(p, food)}
          onSkip={() => setPending((arr) => arr.filter((x) => x._id !== p._id))}
          settings={state.settings || {}}
          meal={mealNow()}
          favouriteIds={state.favouriteBrands || []}
          onToggleFav={toggleFavourite}
          brandUsage={state.brandUsage || {}}
        />
      ))}

      {/* Today's eaten list */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-display text-base text-chocolate">Eaten today</h3>
          <div className="flex gap-1.5">
            <input ref={photoFileRef} type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={(e) => { handlePhotoCapture(e.target.files?.[0]); e.target.value = ''; }}/>
            <button onClick={() => setCustomOpen(true)} className="btn-soft text-xs h-8 px-3">+ Custom</button>
            <button onClick={() => photoFileRef.current?.click()} className="btn-soft text-xs h-8 px-3 inline-flex items-center gap-1.5">
              <CameraIcon/> Snap meal
            </button>
          </div>
        </div>
        <FoodEntryList entries={dayFood} onDelete={removeFood}
          onEdit={(e) => e.needsMacros ? setPhotoEntry(e) : setEditingEntry(e)} />
      </section>

      {editingEntry && (
        <EntryEditor entry={editingEntry} cachedBrands={state.cachedBrands || {}}
          onSave={updateFood}
          onDelete={() => { removeFood(editingEntry.id); setEditingEntry(null); }}
          onClose={() => setEditingEntry(null)}/>
      )}
      {photoEntry && (
        <PhotoMealCapture entry={photoEntry} photoMeals={state.photoMeals || {}}
          onResolve={resolvePhotoMeal} onClose={() => setPhotoEntry(null)}/>
      )}
      {customOpen && (
        <CustomFoodEditor
          onSave={(food) => { saveCustomFood(food); setCustomOpen(false); }}
          onSaveAndLog={(food) => { saveCustomFoodAndLog(null, food); setCustomOpen(false); }}
          onClose={() => setCustomOpen(false)}/>
      )}
    </div>
  );
}

function mealNow() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}
function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
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
