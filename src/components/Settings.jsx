import { useState } from 'react';
import { dailyCalorieTarget, todayISO, newId } from '../utils/storage.js';

export default function Settings({ state, setState }) {
  const [draft, setDraft] = useState({
    profile: { ...state.profile },
    goals: { ...state.goals },
  });

  const target = dailyCalorieTarget(draft.profile, draft.goals);

  const saveProfile = () => setState({ ...state, profile: { ...draft.profile }, goals: { ...draft.goals } });

  const setP = (k,v) => setDraft({ ...draft, profile: { ...draft.profile, [k]: v } });
  const setG = (k,v) => setDraft({ ...draft, goals: { ...draft.goals, [k]: v } });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cradle-export-${todayISO()}.json`;
    a.click();
  };

  const clearAll = () => {
    if (!confirm('Reset all entries, recipes and weights? Your goals & profile stay.')) return;
    setState({ ...state, foodEntries: [], exerciseEntries: [], recipes: [], weights: [] });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Settings</p>
        <h1 className="font-display text-3xl">You & your goals</h1>
      </div>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">About you</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Name">
            <input value={draft.profile.name} onChange={(e)=>setP('name', e.target.value)} className="input" placeholder="Your name"/>
          </Field>
          <Field label="Current weight (kg)">
            <input type="number" step="0.1" value={draft.profile.weightKg} onChange={(e)=>setP('weightKg', +e.target.value)} className="input"/>
          </Field>
          <Field label="Height (cm)">
            <input type="number" value={draft.profile.heightCm} onChange={(e)=>setP('heightCm', +e.target.value)} className="input"/>
          </Field>
          <Field label="Age">
            <input type="number" value={draft.profile.age} onChange={(e)=>setP('age', +e.target.value)} className="input"/>
          </Field>
          <Field label="Activity level">
            <select value={draft.profile.activity} onChange={(e)=>setP('activity', +e.target.value)} className="input">
              <option value={1.3}>Mostly resting (newborn weeks)</option>
              <option value={1.45}>Light (walks, gentle pilates)</option>
              <option value={1.6}>Moderate (regular workouts)</option>
              <option value={1.75}>High (training most days)</option>
            </select>
          </Field>
          <Field label="Breastfeeding">
            <select value={draft.profile.breastfeeding ? 'y':'n'} onChange={(e)=>setP('breastfeeding', e.target.value === 'y')} className="input">
              <option value="y">Yes (+ ~400 kcal)</option>
              <option value="n">No</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Goals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Goal weight (kg)">
            <input type="number" step="0.1" value={draft.goals.weightKg} onChange={(e)=>setG('weightKg', +e.target.value)} className="input"/>
          </Field>
          <Field label="Weekly running (km)">
            <input type="number" value={draft.goals.weeklyKm} onChange={(e)=>setG('weeklyKm', +e.target.value)} className="input"/>
          </Field>
          <Field label="Protein target (g/day)">
            <input type="number" value={draft.goals.proteinG} onChange={(e)=>setG('proteinG', +e.target.value)} className="input"/>
          </Field>
          <Field label="Fibre target (g/day)">
            <input type="number" value={draft.goals.fiberG} onChange={(e)=>setG('fiberG', +e.target.value)} className="input"/>
          </Field>
          <Field label="Fruit + Veg serves/day">
            <input type="number" value={draft.goals.fruitVegServes} onChange={(e)=>setG('fruitVegServes', +e.target.value)} className="input"/>
          </Field>
          <Field label="Target date">
            <input type="date" value={draft.goals.targetDate || ''} onChange={(e)=>setG('targetDate', e.target.value)} className="input"/>
          </Field>
        </div>
        <div className="text-sm text-plum bg-sand/50 rounded-2xl px-4 py-3">
          Estimated daily calorie target: <span className="font-display text-lg">{target}</span> kcal
          <span className="text-muted text-xs"> &nbsp;(based on weight {draft.profile.weightKg}kg, height {draft.profile.heightCm}cm, age {draft.profile.age}, activity & breastfeeding)</span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={exportData} className="btn-ghost">Export data</button>
        <button onClick={clearAll} className="btn-ghost text-rose">Reset entries</button>
        <button onClick={saveProfile} className="btn-primary">Save</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
