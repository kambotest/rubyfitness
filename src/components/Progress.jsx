import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, AreaChart, Area, CartesianGrid,
} from 'recharts';
import { isoDaysAgo, todayISO, dailyCalorieTarget, newId } from '../utils/storage.js';

const RANGES = [
  { id: 7,   label: '7 days' },
  { id: 30,  label: '30 days' },
  { id: 90,  label: '90 days' },
  { id: 180, label: '6 months' },
];

export default function Progress({ state, setState }) {
  const [range, setRange] = useState(30);
  const start = isoDaysAgo(range - 1);
  const days = useMemo(() => buildDays(state, start, range), [state, start, range]);
  const target = dailyCalorieTarget(state.profile, state.goals);

  const weeklyKm = useMemo(() => {
    const km = days.reduce((s, d) => s + d.km, 0);
    const weeks = range / 7;
    return Math.round((km / weeks) * 10) / 10;
  }, [days, range]);

  const avgKcal = Math.round(days.reduce((s,d)=>s+d.kcal,0) / Math.max(1, days.filter(d=>d.kcal>0).length || 1));
  const avgProt = Math.round(days.reduce((s,d)=>s+d.protein,0) / Math.max(1, days.filter(d=>d.protein>0).length || 1));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Progress</p>
          <h1 className="font-display text-3xl text-ink">The bigger picture</h1>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${range===r.id ? 'bg-moss text-cream' : 'bg-white/60 text-plum border border-sand'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <section className="card p-5">
        <Header title="Weight" sub={`Goal ${state.goals.weightKg} kg`} right={<AddWeight state={state} setState={setState} />} />
        <div className="h-56 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days}>
              <defs>
                <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D9A6A1" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#D9A6A1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#EFE6D8" vertical={false}/>
              <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8078' }} tickFormatter={shortDate} interval={Math.floor(days.length/6)}/>
              <YAxis tick={{ fontSize: 10, fill: '#8A8078' }} domain={['auto','auto']} width={28}/>
              <Tooltip content={<Soft />}/>
              <ReferenceLine y={state.goals.weightKg} stroke="#5E7257" strokeDasharray="4 4" label={{ value:'goal', fontSize:10, fill:'#5E7257' }}/>
              <Area type="monotone" dataKey="weight" stroke="#D9A6A1" fill="url(#w)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-5">
        <div className="card p-5">
          <Header title="Calories vs target" sub={`avg ${avgKcal} kcal · target ${target}`} />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid stroke="#EFE6D8" vertical={false}/>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8078' }} tickFormatter={shortDate} interval={Math.floor(days.length/6)}/>
                <YAxis tick={{ fontSize: 10, fill: '#8A8078' }} width={28}/>
                <Tooltip content={<Soft />}/>
                <ReferenceLine y={target} stroke="#5E7257" strokeDasharray="4 4"/>
                <Bar dataKey="kcal" fill="#C9A98C" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <Header title="Running" sub={`${weeklyKm} km/week avg · goal ${state.goals.weeklyKm} km`} />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid stroke="#EFE6D8" vertical={false}/>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8078' }} tickFormatter={shortDate} interval={Math.floor(days.length/6)}/>
                <YAxis tick={{ fontSize: 10, fill: '#8A8078' }} width={28}/>
                <Tooltip content={<Soft />}/>
                <Bar dataKey="km" fill="#5E7257" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <Header title="Protein" sub={`avg ${avgProt} g/day · target ${state.goals.proteinG} g`} />
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days}>
              <CartesianGrid stroke="#EFE6D8" vertical={false}/>
              <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8078' }} tickFormatter={shortDate} interval={Math.floor(days.length/6)}/>
              <YAxis tick={{ fontSize: 10, fill: '#8A8078' }} width={28}/>
              <Tooltip content={<Soft />}/>
              <ReferenceLine y={state.goals.proteinG} stroke="#5E7257" strokeDasharray="4 4"/>
              <Line type="monotone" dataKey="protein" stroke="#6B4F60" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-5">
        <Header title="Variety streak" sub="Daily food groups represented" />
        <Streak days={days}/>
      </section>
    </div>
  );
}

function Header({ title, sub, right }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="font-display text-lg">{title}</h2>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function shortDate(iso) {
  const d = new Date(iso); return `${d.getDate()}/${d.getMonth()+1}`;
}

function Soft({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 border border-sand rounded-xl px-3 py-2 shadow-soft text-xs">
      <div className="text-plum font-medium mb-0.5">{shortDate(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-muted">
          {p.dataKey}: <span className="text-ink font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Streak({ days }) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1">
      {days.map((d) => {
        const v = Math.min(7, d.groups);
        const opacity = v === 0 ? 0.15 : 0.25 + v * 0.1;
        return (
          <div key={d.d} title={`${d.d}: ${d.groups} groups`}
            className="aspect-square rounded-md"
            style={{ background:`rgba(94,114,87,${opacity})` }} />
        );
      })}
    </div>
  );
}

function AddWeight({ state, setState }) {
  const [kg, setKg] = useState('');
  return (
    <form className="flex gap-2 items-center" onSubmit={(e)=>{
      e.preventDefault();
      const v = parseFloat(kg);
      if (!Number.isFinite(v)) return;
      const date = todayISO();
      const next = state.weights.filter((w) => w.date !== date);
      next.push({ id: newId(), date, kg: v });
      setState({ ...state, weights: next, profile: { ...state.profile, weightKg: v } });
      setKg('');
    }}>
      <input value={kg} onChange={(e)=>setKg(e.target.value)} type="number" step="0.1"
        placeholder="kg today" className="input py-1.5 px-3 w-24 text-sm" />
      <button className="btn-soft py-1.5 px-3 text-sm">Add</button>
    </form>
  );
}

// Build per-day rollup over the range.
function buildDays(state, startISO, count) {
  const days = [];
  const start = new Date(startISO);
  for (let i = 0; i < count; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    days.push({ d: iso, kcal:0, protein:0, carbs:0, fat:0, fiber:0, km:0, burned:0, weight:null, groups:0 });
  }
  const idx = (iso) => days.findIndex((x) => x.d === iso);

  state.foodEntries.forEach((e) => {
    const i = idx(e.date); if (i < 0) return;
    days[i].kcal += e.kcal; days[i].protein += e.protein;
    days[i].carbs += e.carbs; days[i].fat += e.fat; days[i].fiber += e.fiber;
  });
  state.exerciseEntries.forEach((e) => {
    const i = idx(e.date); if (i < 0) return;
    days[i].burned += e.kcal;
    if (e.km) days[i].km += e.km;
  });
  // weight forward-fill
  const weights = [...state.weights].sort((a,b) => a.date.localeCompare(b.date));
  let last = null;
  days.forEach((day) => {
    const w = weights.find((x) => x.date === day.d);
    if (w) last = w.kg;
    day.weight = last;
  });
  // group variety per day
  days.forEach((day) => {
    const groups = new Set();
    state.foodEntries.filter((e) => e.date === day.d).forEach((e) => {
      // we count by name lookup since group isn't stored
      // fallback: heuristic based on kcal & macros
      if (e.protein >= 8 && e.fat <= 8) groups.add('protein');
      if (e.fiber >= 2 && e.kcal <= 80) groups.add('veg');
      if (e.carbs >= 15 && e.kcal <= 100) groups.add('fruit');
      if (e.carbs >= 20 && e.fiber >= 1) groups.add('grain');
      if (e.fat >= 8) groups.add('fat');
    });
    day.groups = groups.size;
  });
  return days;
}
