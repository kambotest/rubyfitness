import { useMemo, useState } from 'react';
import VoiceInput from './VoiceInput.jsx';
import { ExerciseEntryList } from './EntryList.jsx';
import { EXERCISES, findExercise, kcalBurned } from '../data/exercises.js';
import { todayISO, newId } from '../utils/storage.js';
import { parseExerciseTranscript } from '../utils/parser.js';
import { useUndo } from './UndoToast.jsx';

// Move tab — structured exercise entry + voice/text input + day's log.
export default function MoveTab({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const { offerUndo } = useUndo();

  // Structured form state
  const [activity, setActivity] = useState(EXERCISES[0]?.id || 'walk_easy');
  const [minutes, setMinutes] = useState(30);
  const [km, setKm] = useState('');
  const [intensity, setIntensity] = useState('moderate');
  const [notes, setNotes] = useState('');

  const dayEx = useMemo(() => state.exerciseEntries.filter((e) => e.date === date), [state.exerciseEntries, date]);

  const submitForm = (e) => {
    e?.preventDefault?.();
    const ex = EXERCISES.find((x) => x.id === activity);
    if (!ex) return;
    const intensityMult = intensity === 'easy' ? 0.85 : intensity === 'hard' ? 1.15 : 1;
    const baseMet = ex.met * intensityMult;
    const m = Math.max(1, Number(minutes) || 0);
    const w = state.profile?.weightKg || 70;
    const kcal = Math.round(baseMet * w * (m / 60));
    const entry = {
      id: newId(), date,
      exerciseId: ex.id,
      name: ex.name,
      minutes: m,
      km: km !== '' ? Number(km) : null,
      kcal,
      intensity,
      notes: notes.trim() || undefined,
      raw: notes.trim() || `${ex.name}, ${m} min`,
    };
    setState((s) => ({ ...s, exerciseEntries: [...s.exerciseEntries, entry] }));
    offerUndo(`Logged ${ex.name}, ${m} min`, () => {
      setState((s) => ({ ...s, exerciseEntries: s.exerciseEntries.filter((x) => x.id !== entry.id) }));
    });
    // Reset form
    setMinutes(30); setKm(''); setIntensity('moderate'); setNotes('');
  };

  const submitVoice = (text) => {
    const parsed = parseExerciseTranscript(text, state.profile.weightKg);
    if (!parsed || parsed.unknown) return;
    const entry = { id: newId(), date, ...parsed };
    setState((s) => ({ ...s, exerciseEntries: [...s.exerciseEntries, entry] }));
    offerUndo(`Logged ${parsed.name}, ${parsed.minutes} min`, () => {
      setState((s) => ({ ...s, exerciseEntries: s.exerciseEntries.filter((x) => x.id !== entry.id) }));
    });
  };

  const removeEx = (id) => {
    let removed;
    setState((s) => {
      removed = s.exerciseEntries.find((e) => e.id === id);
      return { ...s, exerciseEntries: s.exerciseEntries.filter((e) => e.id !== id) };
    });
    if (removed) offerUndo(`Removed ${removed.name}`, () => {
      setState((s) => ({ ...s, exerciseEntries: [...s.exerciseEntries, removed] }));
    });
  };

  // Group exercises by tag for the dropdown
  const grouped = useMemo(() => {
    const groups = {};
    for (const e of EXERCISES) {
      const tag = (e.tags && e.tags[0]) || 'other';
      (groups[tag] = groups[tag] || []).push(e);
    }
    return groups;
  }, []);

  const totalMin = dayEx.reduce((s, e) => s + (e.minutes || 0), 0);
  const totalKcal = dayEx.reduce((s, e) => s + (e.kcal || 0), 0);
  const totalKm = dayEx.reduce((s, e) => s + (e.km || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-0.5">{prettyDate(date)}</p>
          <h1 className="font-display text-2xl text-chocolate leading-tight">Movement</h1>
          {dayEx.length > 0 && (
            <p className="text-xs text-muted mt-1">
              {totalMin} min · {totalKcal} kcal{totalKm > 0 ? ` · ${Math.round(totalKm * 10) / 10} km` : ''}
            </p>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-white border border-stone rounded-md px-3 py-2 text-sm" />
      </div>

      {/* Structured entry form */}
      <section className="card p-5">
        <h2 className="font-display text-base text-chocolate mb-3">Log exercise</h2>
        <form onSubmit={submitForm} className="space-y-3">
          <Field label="Activity">
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="input text-sm">
              {Object.entries(grouped).map(([tag, list]) => (
                <optgroup key={tag} label={tag}>
                  {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (minutes)">
              <input type="number" inputMode="numeric" min="1" step="1"
                value={minutes} onChange={(e) => setMinutes(e.target.value)}
                className="input text-sm"/>
            </Field>
            <Field label="Distance (km, optional)">
              <input type="number" inputMode="decimal" min="0" step="0.1"
                value={km} onChange={(e) => setKm(e.target.value)}
                className="input text-sm" placeholder="—"/>
            </Field>
          </div>
          <Field label="Intensity">
            <div className="flex gap-1.5">
              {['easy', 'moderate', 'hard'].map((i) => (
                <button type="button" key={i} onClick={() => setIntensity(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                    intensity === i ? 'bg-caramel text-canvas border-caramel' : 'bg-white text-cocoa border-stone'
                  }`}>
                  {i[0].toUpperCase() + i.slice(1)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes (optional)">
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?" className="input text-sm"/>
          </Field>
          <div className="flex justify-end pt-1">
            <button type="submit" className="btn-primary text-sm">Log exercise</button>
          </div>
        </form>
      </section>

      {/* Voice/text shortcut */}
      <VoiceInput onSubmit={submitVoice}
        placeholder='Or dictate: "ran 5km in 32 minutes" or "45 min walk"' />

      {/* Today's movement list */}
      <section className="card p-5">
        <h3 className="font-display text-base text-chocolate mb-2">Today's movement</h3>
        <ExerciseEntryList entries={dayEx} onDelete={removeEx} />
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
