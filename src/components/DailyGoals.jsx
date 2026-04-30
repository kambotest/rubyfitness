import { useMemo, useState } from 'react';
import { todayISO, isoDaysAgo, newId } from '../utils/storage.js';

// Daily checklist of recurring habits the user wants to confirm each day.
// Goals are editable (add / rename / remove). Per-day state is tracked in
// state.dailyChecks keyed by ISO date so the Progress tab can later
// surface streaks if you want.
export default function DailyGoals({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');

  const goals = state.dailyGoals || [];
  const checksToday = state.dailyChecks?.[date] || {};
  const doneCount = goals.reduce((n, g) => n + (checksToday[g.id] ? 1 : 0), 0);
  const allDone = goals.length > 0 && doneCount === goals.length;

  const toggle = (goalId) => {
    setState((s) => {
      const day = { ...(s.dailyChecks?.[date] || {}) };
      day[goalId] = !day[goalId];
      return { ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: day } };
    });
  };

  const checkAll = () => {
    setState((s) => {
      const day = {};
      (s.dailyGoals || []).forEach((g) => { day[g.id] = true; });
      return { ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: day } };
    });
  };
  const clearAll = () => {
    setState((s) => ({ ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: {} } }));
  };

  const updateLabel = (id, label) => {
    setState((s) => ({
      ...s,
      dailyGoals: (s.dailyGoals || []).map((g) => (g.id === id ? { ...g, label } : g)),
    }));
  };
  const removeGoal = (id) => {
    setState((s) => ({
      ...s,
      dailyGoals: (s.dailyGoals || []).filter((g) => g.id !== id),
    }));
  };
  const addGoal = () => {
    const label = draftLabel.trim();
    if (!label) return;
    setState((s) => ({
      ...s,
      dailyGoals: [...(s.dailyGoals || []), { id: newId(), label }],
    }));
    setDraftLabel('');
  };

  // Streak: how many consecutive prior days had all goals checked.
  const streak = useMemo(() => computeStreak(state.dailyChecks || {}, goals, date), [state.dailyChecks, goals, date]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Daily goals</p>
          <h1 className="font-display text-3xl">{allDone ? 'All complete' : 'Daily checklist'}</h1>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-white/70 border border-sand rounded-xl px-3 py-2 text-sm" />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display text-2xl">{doneCount}<span className="text-muted text-base"> / {goals.length}</span></div>
            <div className="text-xs text-muted">{prettyDate(date)} · {streak > 0 ? `${streak}-day streak` : 'No streak yet'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={clearAll} className="btn-ghost text-xs">Clear</button>
            <button onClick={checkAll} className="btn-soft text-xs">Mark all done</button>
            <button onClick={() => setEditing((e) => !e)} className={`text-xs ${editing ? 'btn-primary' : 'btn-soft'}`}>
              {editing ? 'Done' : 'Edit list'}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-sand/70">
          {goals.map((g) => {
            const checked = !!checksToday[g.id];
            return (
              <li key={g.id} className="py-3">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input value={g.label}
                      onChange={(e) => updateLabel(g.id, e.target.value)}
                      className="input flex-1 text-sm"/>
                    <button onClick={() => removeGoal(g.id)}
                      className="text-muted hover:text-rose text-sm px-2"
                      aria-label="Remove">×</button>
                  </div>
                ) : (
                  <button onClick={() => toggle(g.id)}
                    className="w-full flex items-center gap-3 text-left active:scale-[.99] transition">
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      checked ? 'bg-moss border-moss text-cream' : 'bg-white border-sand'
                    }`}>
                      {checked && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4 10-10"/>
                        </svg>
                      )}
                    </span>
                    <span className={`text-base ${checked ? 'line-through text-muted' : 'text-ink'}`}>
                      {g.label}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
          {!goals.length && (
            <li className="py-4 text-sm text-muted italic">No goals defined. Tap "Edit list" to add.</li>
          )}
        </ul>

        {editing && (
          <div className="mt-3 flex gap-2 pt-3 border-t border-sand">
            <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
              placeholder="Add a goal — e.g. '500 mg vitamin C'"
              className="input flex-1 text-sm"/>
            <button onClick={addGoal} disabled={!draftLabel.trim()} className="btn-primary text-sm">Add</button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="font-display text-lg mb-3">Last 7 days</h3>
        <Last7Days state={state} goals={goals} />
      </section>
    </div>
  );
}

function Last7Days({ state, goals }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = isoDaysAgo(i);
    const checks = state.dailyChecks?.[d] || {};
    const done = goals.reduce((n, g) => n + (checks[g.id] ? 1 : 0), 0);
    days.push({ date: d, done, total: goals.length });
  }
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const pct = d.total ? d.done / d.total : 0;
        const full = pct === 1;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xs font-medium
              ${full ? 'bg-moss text-cream' : pct > 0 ? 'bg-sage/30 text-plum' : 'bg-sand text-muted'}`}>
              {d.done}/{d.total || '–'}
            </div>
            <div className="text-[9px] text-muted">{shortDay(d.date)}</div>
          </div>
        );
      })}
    </div>
  );
}

function computeStreak(checks, goals, fromDate) {
  if (!goals.length) return 0;
  let streak = 0;
  // Start at the day before fromDate (today's streak only counts if today is complete).
  const today = checks[fromDate] || {};
  const todayAllDone = goals.every((g) => today[g.id]);
  let cursor = new Date(fromDate + 'T00:00');
  if (todayAllDone) streak += 1;
  for (let i = 1; i <= 365; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const day = checks[iso] || {};
    const allDone = goals.every((g) => day[g.id]);
    if (!allDone) break;
    streak += 1;
  }
  return streak;
}

function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function shortDay(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' });
}
