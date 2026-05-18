import { useRef, useState } from 'react';
import {
  bmr, tdee, lactationKcal, weightLossDeficit, dailyCalorieTarget,
  macroTargets, todayISO, emptyState,
} from '../utils/storage.js';
import { parseAppleHealthExport, mergeAppleHealthIntoState } from '../utils/healthSync.js';
import { permissionState, requestPermission } from '../utils/notifications.js';
import MicField from './MicField.jsx';
import CustomFoodEditor from './CustomFoodEditor.jsx';
import { useUndo } from './UndoToast.jsx';

export default function Settings({ state, setState }) {
  const [draft, setDraft] = useState({
    profile:  { ...state.profile },
    goals:    { ...state.goals },
    settings: { ...state.settings },
  });

  const energy = {
    bmr: bmr(draft.profile),
    tdee: tdee(draft.profile),
    lactation: lactationKcal(draft.profile),
    deficit: weightLossDeficit(draft.profile, draft.goals),
    target: dailyCalorieTarget(draft.profile, draft.goals),
  };
  const macros = macroTargets(draft.profile, draft.goals);

  const save = () => setState({
    ...state,
    profile:  { ...draft.profile },
    goals:    { ...draft.goals },
    settings: { ...draft.settings },
  });

  const setP = (k, v) => setDraft({ ...draft, profile:  { ...draft.profile,  [k]: v } });
  const setG = (k, v) => setDraft({ ...draft, goals:    { ...draft.goals,    [k]: v } });
  const setS = (k, v) => setDraft({ ...draft, settings: { ...draft.settings, [k]: v } });

  // ---- Health sync (Apple Health XML import) ----
  const healthFileRef = useRef(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthMsg, setHealthMsg] = useState('');
  const importAppleHealth = async (file) => {
    if (!file) return;
    setHealthBusy(true); setHealthMsg('Reading export.xml…');
    try {
      const text = await file.text();
      const parsed = await parseAppleHealthExport(text);
      const merged = mergeAppleHealthIntoState(state, parsed);
      const { _imported, ...clean } = merged;
      setState(clean);
      setHealthMsg(`Imported ${_imported.workouts} workouts and ${_imported.weights} weights.`);
    } catch (e) {
      setHealthMsg(`Could not import: ${e.message || e}`);
    } finally {
      setHealthBusy(false);
    }
  };

  // ---- Notifications ----
  const notifPerm = permissionState();
  const enableNotifications = async () => {
    const r = await requestPermission();
    if (r === 'granted') {
      setDraft({ ...draft, settings: { ...draft.settings } });
      setState((s) => ({ ...s, notifications: { ...(s.notifications || {}), enabled: true } }));
    }
  };
  const setNotifTrigger = (k, v) => {
    setState((s) => ({
      ...s,
      notifications: {
        ...(s.notifications || {}),
        triggers: { ...((s.notifications || {}).triggers || {}), [k]: v },
      },
    }));
  };
  const setNotifQuiet = (k, v) => {
    setState((s) => ({ ...s, notifications: { ...(s.notifications || {}), [k]: v } }));
  };

  // ---- Custom foods management ----
  const [editingCustom, setEditingCustom] = useState(null); // food being edited or null
  const { offerUndo } = useUndo();
  const customFoods = state.customFoods || [];

  const removeCustomFood = (id) => {
    let removed;
    setState((s) => {
      removed = (s.customFoods || []).find((f) => f.id === id);
      return { ...s, customFoods: (s.customFoods || []).filter((f) => f.id !== id) };
    });
    if (removed) offerUndo(`Removed "${removed.name}"`, () => {
      setState((s) => ({ ...s, customFoods: [...(s.customFoods || []), removed] }));
    });
  };

  const updateCustomFood = (food) => {
    setState((s) => ({
      ...s,
      customFoods: (s.customFoods || []).map((f) => (f.id === food.id ? food : f)),
    }));
    setEditingCustom(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `built-different-export-${todayISO()}.json`;
    a.click();
  };

  const clearAll = () => {
    if (!confirm('Reset all entries, recipes and weights? Your goals & profile stay.')) return;
    setState({ ...state, foodEntries: [], exerciseEntries: [], recipes: [], weights: [] });
  };

  const factoryReset = () => {
    const ok = confirm(
      "Wipe ALL data and start fresh?\n\n"
      + "This deletes your profile, weight, goals, food log, recipes, "
      + "custom foods, favourites, hydration history, daily checks, and "
      + "settings. You can undo for 4 seconds after.\n\n"
      + "Continue?"
    );
    if (!ok) return;
    const snapshot = state;
    setState(emptyState());
    offerUndo('All data cleared', () => setState(snapshot));
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Settings</p>
        <h1 className="font-display text-3xl">Profile and goals</h1>
      </div>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">About you</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Name">
            <MicField value={draft.profile.name} onChange={(e)=>setP('name', e.target.value)} className="input" placeholder="Your name"/>
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
              <option value={1.3}>Sedentary (PAL 1.3)</option>
              <option value={1.45}>Light (PAL 1.45)</option>
              <option value={1.6}>Moderate (PAL 1.6)</option>
              <option value={1.75}>High (PAL 1.75)</option>
            </select>
          </Field>
          <Field label="Breastfeeding">
            <select value={draft.profile.breastfeeding ? 'y':'n'} onChange={(e)=>setP('breastfeeding', e.target.value === 'y')} className="input">
              <option value="y">Yes (+400 kcal)</option>
              <option value="n">No</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Energy & weight loss</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <EnergyCell label="BMR (Mifflin-St Jeor)" value={energy.bmr} sub="kcal at rest"/>
          <EnergyCell label="TDEE (BMR × activity)" value={energy.tdee} sub="kcal/day"/>
          <EnergyCell label="Lactation extra" value={energy.lactation} sub={energy.lactation ? 'kcal added' : 'not feeding'}/>
          <EnergyCell label="Weight-loss deficit" value={`-${energy.deficit}`} sub="kcal/day"/>
        </div>
        <div className="text-sm text-plum bg-sand/50 rounded-2xl px-4 py-3">
          Daily calorie target: <span className="font-display text-xl">{energy.target}</span> kcal
          <span className="text-muted text-xs"> &nbsp;= TDEE {energy.tdee} {energy.lactation ? `+ ${energy.lactation}` : ''} − {energy.deficit} (safety floor applied)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Goal weight (kg)">
            <input type="number" step="0.1" value={draft.goals.weightKg} onChange={(e)=>setG('weightKg', +e.target.value)} className="input"/>
          </Field>
          <Field label="Weight loss rate (kg/week)">
            <select value={draft.goals.weightLossKgPerWeek} onChange={(e)=>setG('weightLossKgPerWeek', +e.target.value)} className="input">
              <option value={0}>Maintain (no deficit)</option>
              <option value={0.25}>Gentle — 0.25 kg/week</option>
              <option value={0.35}>Moderate — 0.35 kg/week</option>
              <option value={0.5}>Faster — 0.5 kg/week</option>
            </select>
          </Field>
          <Field label="Macro strategy">
            <select value={draft.goals.macroStrategy} onChange={(e)=>setG('macroStrategy', e.target.value)} className="input">
              <option value="hba1c">HbA1c-stable (higher protein, lower carb)</option>
              <option value="balanced">Balanced (Aus dietary guidelines)</option>
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-muted">
          The HbA1c-stable strategy biases toward protein (~1.8 g/kg) and caps carbs at 45% of energy — supported by evidence on
          lower-glycaemic-load patterns for blood-glucose stability. The balanced strategy follows the standard 20/50/30 split.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Daily targets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <EnergyCell label="Calories" value={macros.kcal} sub="kcal/day"/>
          <EnergyCell label="Protein" value={`${macros.protein}g`} sub={`${pct(macros.protein*4, macros.kcal)}% kcal`}/>
          <EnergyCell label="Carbs" value={`${macros.carbs}g`} sub={`${pct(macros.carbs*4, macros.kcal)}% kcal`}/>
          <EnergyCell label="Fat" value={`${macros.fat}g`} sub={`${pct(macros.fat*9, macros.kcal)}% kcal`}/>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Fibre target (g/day)">
            <input type="number" value={draft.goals.fiberG} onChange={(e)=>setG('fiberG', +e.target.value)} className="input"/>
          </Field>
          <Field label="Free sugar cap (g/day)">
            <input type="number" value={draft.goals.sugarG} onChange={(e)=>setG('sugarG', +e.target.value)} className="input"/>
          </Field>
          <Field label="Distinct plants per week">
            <input type="number" value={draft.goals.plantsPerWeek ?? 50}
              onChange={(e)=>setG('plantsPerWeek', +e.target.value)} className="input"/>
          </Field>
          <Field label="Hydration target (mL/day)">
            <input type="number" step="100" value={draft.goals.hydrationMl ?? 2500}
              onChange={(e)=>setG('hydrationMl', +e.target.value)} className="input"/>
          </Field>
        </div>
        <p className="text-[11px] text-muted">
          The Sugar ring tracks <em>free sugars</em> only — added sugars plus sugars in honey, syrups,
          fruit juices and dried fruit per the WHO definition. Naturally occurring sugars in whole
          fruit, vegetables and plain dairy don't count toward this cap. Default 25 g/day matches
          the American Heart Association guideline for women and the WHO &lt;10% energy target.
          Lower caps (≤20 g) suit HbA1c reduction.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Brand-food lookup</h2>
        <Field label="Server proxy URL (optional)">
          <input value={draft.settings.proxyEndpoint || ''}
            onChange={(e)=>setS('proxyEndpoint', e.target.value)}
            placeholder="https://your-worker.example.workers.dev"
            className="input" type="url"/>
        </Field>
        <p className="text-[11px] text-muted">
          When set, brand searches and barcode scans first try your proxy (which scrapes Woolworths / manufacturer NIPs)
          before falling back to Open Food Facts. See <code className="text-[10px]">/server-proxy/README.md</code> in the
          repo for a Cloudflare Worker reference.
        </p>
        <Field label="Open Food Facts fallback">
          <select value={draft.settings.enableOFF ? 'y' : 'n'}
            onChange={(e)=>setS('enableOFF', e.target.value === 'y')} className="input">
            <option value="y">Enabled (used only if curated + proxy miss)</option>
            <option value="n">Disabled</option>
          </select>
        </Field>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Health sync</h2>
        <div>
          <p className="text-xs text-muted mb-2">
            On iPhone: Health app → profile (top right) → <em>Export All Health Data</em>. Unzip the
            file and upload <code className="text-[10px]">export.xml</code> below. Workouts and body-weight
            entries from the last few months will merge in. Steps and heart rate are not imported.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={healthFileRef} type="file" accept=".xml,application/xml,text/xml"
              className="hidden"
              onChange={(e) => { importAppleHealth(e.target.files?.[0]); e.target.value = ''; }}/>
            <button onClick={() => healthFileRef.current?.click()} disabled={healthBusy}
              className="btn-soft text-sm">
              {healthBusy ? 'Importing…' : 'Import Apple Health export.xml'}
            </button>
            {state.healthSync?.appleHealthLastImportAt && (
              <span className="text-[11px] text-muted">
                Last import: {new Date(state.healthSync.appleHealthLastImportAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {healthMsg && <p className="text-xs text-plum mt-2">{healthMsg}</p>}
        </div>
        <div className="border-t border-sand pt-3">
          <p className="text-xs text-muted">
            Google Fit and live HealthKit sync require a deployer-side OAuth client ID and (for HealthKit)
            wrapping the app in a native iOS shell. The architecture is in place — see
            {' '}<code className="text-[10px]">src/utils/healthSync.js</code> for the OAuth flow.
          </p>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Notifications</h2>
        <p className="text-[11px] text-muted">
          Notifications fire while the app is open in the browser or installed as a PWA. They don't reach
          you when the app has been closed for a long time — that requires a backend with VAPID push,
          which isn't part of this build.
        </p>
        {notifPerm === 'unsupported' ? (
          <p className="text-sm text-muted">Notifications aren't supported in this browser.</p>
        ) : notifPerm === 'denied' ? (
          <p className="text-sm text-rose">Permission was denied. Enable it in your browser's site settings.</p>
        ) : notifPerm === 'default' || !state.notifications?.enabled ? (
          <button onClick={enableNotifications} className="btn-primary text-sm">Enable notifications</button>
        ) : (
          <div className="space-y-2">
            <NotifToggle label="Streak at risk after 8 PM"
              checked={!!state.notifications?.triggers?.streakAtRisk}
              onChange={(v) => setNotifTrigger('streakAtRisk', v)} />
            <NotifToggle label="No food logged by 11 AM"
              checked={!!state.notifications?.triggers?.mealCadence}
              onChange={(v) => setNotifTrigger('mealCadence', v)} />
            <NotifToggle label="Hydration below 50% by 2 PM"
              checked={!!state.notifications?.triggers?.hydrationLow}
              onChange={(v) => setNotifTrigger('hydrationLow', v)} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Quiet hours start">
                <input type="time" value={state.notifications?.quietStart || '21:00'}
                  onChange={(e) => setNotifQuiet('quietStart', e.target.value)} className="input"/>
              </Field>
              <Field label="Quiet hours end">
                <input type="time" value={state.notifications?.quietEnd || '07:00'}
                  onChange={(e) => setNotifQuiet('quietEnd', e.target.value)} className="input"/>
              </Field>
            </div>
            <button
              onClick={() => setState((s) => ({ ...s, notifications: { ...(s.notifications || {}), enabled: false } }))}
              className="btn-ghost text-xs">Disable notifications</button>
          </div>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Your custom foods</h2>
          <span className="text-xs text-muted">{customFoods.length} saved</span>
        </div>
        {customFoods.length === 0 ? (
          <p className="text-sm text-muted">
            Foods you add via the <strong>+ Custom</strong> button on Today (or from the unknown-item picker)
            appear here. Tap a row to edit, swipe-style × to delete.
          </p>
        ) : (
          <ul className="divide-y divide-stone">
            {customFoods.map((f) => (
              <li key={f.id} className="py-2.5 flex items-center gap-2">
                <button onClick={() => setEditingCustom(f)}
                  className="flex-1 text-left min-w-0 px-1 py-1 rounded-xl hover:bg-blush/30 transition">
                  <div className="font-medium text-ink truncate">{f.name}</div>
                  <div className="text-xs text-muted">
                    {f.unit === 'piece'
                      ? `${f.kcal} kcal / piece${f.pieceGrams ? ` (${f.pieceGrams} g)` : ''}`
                      : `${f.kcal} kcal / 100 ${f.unit}${f.pieceGrams ? ` · 1 piece ≈ ${f.pieceGrams} g` : ''}`}
                    {' · '}{f.group}
                  </div>
                </button>
                <button onClick={() => removeCustomFood(f.id)} aria-label="Delete"
                  className="text-muted hover:text-rose text-sm px-2 py-1 shrink-0">×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={exportData} className="btn-ghost">Export data</button>
        <button onClick={clearAll} className="btn-ghost text-rose">Reset entries</button>
        <button onClick={save} className="btn-primary">Save</button>
      </div>

      <section className="card p-5 border-rose/30">
        <h2 className="font-display text-base text-rose mb-1">Danger zone</h2>
        <p className="text-xs text-muted mb-3">
          Wipes everything: profile, weight, goals, food log, recipes, custom foods, favourites,
          hydration history, daily checks, notification settings — back to a brand-new install.
          You'll get a 4-second undo afterwards if you change your mind.
        </p>
        <button onClick={factoryReset}
          className="btn bg-rose text-canvas hover:bg-[#cf9994] text-sm">
          Clear all data
        </button>
      </section>

      {editingCustom && (
        <CustomFoodEditor
          initialFood={editingCustom}
          onSave={updateCustomFood}
          onClose={() => setEditingCustom(null)}
        />
      )}
    </div>
  );
}

function EnergyCell({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-white/80 border border-sand px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-xl text-ink">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
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

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function NotifToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <button onClick={() => onChange(!checked)} type="button"
        className={`w-10 h-6 rounded-full relative transition ${checked ? 'bg-moss' : 'bg-sand'}`}
        aria-pressed={checked} aria-label={label}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`}/>
      </button>
    </label>
  );
}
