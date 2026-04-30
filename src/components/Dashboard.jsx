import { useMemo, useState } from 'react';
import VoiceInput from './VoiceInput.jsx';
import BrandFoodSearch from './BrandFoodSearch.jsx';
import Ring from './Rings.jsx';
import { FoodEntryList, ExerciseEntryList } from './EntryList.jsx';
import UnknownItemFixer from './UnknownItemFixer.jsx';
import {
  parseFoodTranscript, parseExerciseTranscript, classifyTranscript,
} from '../utils/parser.js';
import { findFood, nutrientsFor } from '../data/foods.js';
import { todayISO, newId, dailyCalorieTarget } from '../utils/storage.js';

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

  const dayFood = useMemo(
    () => state.foodEntries.filter((e) => e.date === date),
    [state.foodEntries, date]
  );
  const dayEx = useMemo(
    () => state.exerciseEntries.filter((e) => e.date === date),
    [state.exerciseEntries, date]
  );

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    dayFood.forEach((e) => {
      t.kcal += e.kcal; t.protein += e.protein; t.carbs += e.carbs; t.fat += e.fat; t.fiber += e.fiber;
    });
    return t;
  }, [dayFood]);
  const burned = useMemo(() => dayEx.reduce((s,e) => s + e.kcal, 0), [dayEx]);

  const target = dailyCalorieTarget(state.profile, state.goals);
  const proteinT = state.goals.proteinG;
  const fiberT = state.goals.fiberG;

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

  const removeFood = (id) =>
    setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) }));
  const removeEx = (id) =>
    setState((s) => ({ ...s, exerciseEntries: s.exerciseEntries.filter((e) => e.id !== id) }));

  const logBrand = (entry) => {
    const full = { id: newId(), date, ...entry, meal: entry.meal || currentMeal() };
    setState((s) => ({ ...s, foodEntries: [...s.foodEntries, full] }));
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
  const fruitVegServes = countFruitVegServes(dayFood);
  const groups = countGroups(dayFood);

  return (
    <div className="space-y-5">
      <Header state={state} date={date} setDate={setDate} />

      <BrandFoodSearch
        onLogEntry={logBrand}
        meal={currentMeal()}
        recentIds={recentBrandIds}
      />

      <VoiceInput onSubmit={submit} placeholder={
        mode === 'exercise'
          ? 'e.g. “ran 5km in 32 minutes” or “45 min walk with the pram”'
          : 'e.g. “2 eggs on toast, half an avocado, a flat white”'
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
          onResolve={(payload) => resolveUnknown(p, payload)}
          onSkip={() => setPending((arr) => arr.filter((x) => x._id !== p._id))}
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
        <div className="grid grid-cols-4 gap-2">
          <Ring value={totals.kcal} target={target} label="Calories" sub={`${burned} burned`} color="#5E7257"/>
          <Ring value={totals.protein} target={proteinT} label="Protein" sub="g" color="#6B4F60"/>
          <Ring value={totals.fiber} target={fiberT} label="Fibre" sub="g" color="#C9A98C"/>
          <Ring value={fruitVegServes} target={state.goals.fruitVegServes} label="Fruit + Veg" sub="serves" color="#D9A6A1"/>
        </div>
        <FoodGroupBar groups={groups} />
      </section>

      <section className="grid sm:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-display text-lg mb-2">Eaten</h3>
          <FoodEntryList entries={dayFood} onDelete={removeFood} />
        </div>
        <div className="card p-5">
          <h3 className="font-display text-lg mb-2">Movement</h3>
          <ExerciseEntryList entries={dayEx} onDelete={removeEx} />
        </div>
      </section>
    </div>
  );
}

function Header({ state, date, setDate }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Cradle</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">
          {greeting(state.profile.name)}
        </h1>
      </div>
      <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
        className="bg-white/70 border border-sand rounded-xl px-3 py-2 text-sm" />
    </div>
  );
}

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  return name ? `${g}, ${name}.` : `${g}, mama.`;
}

function prettyDate(iso) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
}

function entryGroup(e) {
  if (e.group) return e.group;             // brand entries carry their group
  const f = findFood(e.name);
  return f ? f.group : null;
}

function countFruitVegServes(entries) {
  let s = 0;
  entries.forEach((e) => {
    const g = entryGroup(e);
    if (g !== 'fruit' && g !== 'veg') return;
    const f = findFood(e.name);
    const grams = e.unit === 'piece' && f?.pieceGrams ? f.pieceGrams * e.amount : e.amount;
    s += grams / 80;
  });
  return Math.round(s * 10) / 10;
}

function countGroups(entries) {
  const groups = { protein:0, grain:0, veg:0, fruit:0, dairy:0, fat:0, legume:0, mixed:0, snack:0, beverage:0, condiment:0 };
  entries.forEach((e) => {
    const g = entryGroup(e);
    if (!g) return;
    groups[g] = (groups[g] || 0) + e.kcal;
  });
  return groups;
}

function FoodGroupBar({ groups }) {
  const order = ['protein','veg','fruit','grain','legume','dairy','fat','mixed','snack','beverage','condiment'];
  const total = Object.values(groups).reduce((a,b)=>a+b,0) || 1;
  const palette = {
    protein:'#6B4F60', veg:'#5E7257', fruit:'#D9A6A1', grain:'#C9A98C',
    legume:'#8FA487', dairy:'#E6DCCE', fat:'#B89F7A', mixed:'#A8927C',
    snack:'#C97B6B', beverage:'#9CB7C9', condiment:'#D8C7A8',
  };
  return (
    <div className="mt-4">
      <div className="text-xs text-muted mb-1.5">Variety today</div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-sand">
        {order.map((g) => groups[g] > 0 && (
          <div key={g} title={`${g}: ${Math.round(groups[g])} kcal`}
            style={{ width: `${(groups[g]/total)*100}%`, background: palette[g] }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted">
        {order.map((g) => groups[g] > 0 && (
          <span key={g} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: palette[g] }} />
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}
