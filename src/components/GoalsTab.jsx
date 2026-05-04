import { useEffect, useMemo, useRef, useState } from 'react';
import { todayISO, isoDaysAgo, isoWeek, newId } from '../utils/storage.js';
import MicField from './MicField.jsx';
import { useUndo } from './UndoToast.jsx';

// Daily goals tab. Checkbox per goal per day, inline timer for time-based
// goals, and a "Defer to tomorrow" action that aggregates the goal onto
// the next day. Deferral is capped at 2 days (so a goal can only be
// pushed forward at most twice).
export default function GoalsTab({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [now, setNow] = useState(Date.now());
  const { offerUndo } = useUndo();

  const goals = state.dailyGoals || [];
  const checksToday = state.dailyChecks?.[date] || {};
  const aggToday = state.goalAggregations?.[date] || {};
  const tomorrow = nextDay(date);

  // Apply aggregation multiplier to a goal's duration label for display.
  const effectiveLabel = (g) => {
    const baseSec = parseGoalDuration(g.label);
    if (!baseSec) return g.label;
    const aggCount = (aggToday[g.id]?.count) || 0;
    if (aggCount === 0) return g.label;
    const totalSec = baseSec * (1 + aggCount);
    const totalMin = Math.round(totalSec / 60);
    // Replace the duration token in the label with the new total.
    return g.label.replace(
      /\d+(?:\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/i,
      `${totalMin} min (deferred)`
    );
  };

  const effectiveDurationSec = (g) => {
    const baseSec = parseGoalDuration(g.label);
    if (!baseSec) return null;
    const aggCount = (aggToday[g.id]?.count) || 0;
    return baseSec * (1 + aggCount);
  };

  // 1Hz tick for countdowns + auto-complete on timer expiry.
  useEffect(() => {
    const advance = () => {
      const t = Date.now();
      setNow(t);
      setState((s) => {
        const timers = s.goalTimers || {};
        let changed = false;
        const day = { ...(s.dailyChecks?.[date] || {}) };
        const newTimers = { ...timers };
        for (const [goalId, timer] of Object.entries(timers)) {
          if (timer.date !== date) continue;
          const elapsed = (t - timer.startedAt) / 1000;
          if (elapsed >= timer.durationSec) {
            day[goalId] = true;
            delete newTimers[goalId];
            changed = true;
          }
        }
        return changed ? {
          ...s,
          dailyChecks: { ...(s.dailyChecks || {}), [date]: day },
          goalTimers: newTimers,
        } : s;
      });
    };
    advance();
    const id = setInterval(advance, 1000);
    return () => clearInterval(id);
  }, [date, setState]);

  const toggle = (goalId) => {
    setState((s) => {
      const day = { ...(s.dailyChecks?.[date] || {}) };
      day[goalId] = !day[goalId];
      const newTimers = { ...(s.goalTimers || {}) };
      if (newTimers[goalId]) delete newTimers[goalId];
      return { ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: day }, goalTimers: newTimers };
    });
  };

  const startTimer = (goalId, durationSec) =>
    setState((s) => ({
      ...s,
      goalTimers: { ...(s.goalTimers || {}), [goalId]: { startedAt: Date.now(), durationSec, date } },
    }));
  const stopTimer = (goalId) =>
    setState((s) => {
      const t = { ...(s.goalTimers || {}) };
      delete t[goalId];
      return { ...s, goalTimers: t };
    });

  // Defer a goal onto tomorrow. Caps at 2 cumulative deferrals.
  const deferToTomorrow = (goal) => {
    setState((s) => {
      const tomorrowAgg = { ...(s.goalAggregations?.[tomorrow] || {}) };
      const prevCount = tomorrowAgg[goal.id]?.count || 0;
      if (prevCount >= 2) return s; // already at the cap
      tomorrowAgg[goal.id] = { count: prevCount + 1, sourceDate: date };
      // Mark today's goal as auto-checked (deferred = handled, not missed)
      const day = { ...(s.dailyChecks?.[date] || {}) };
      day[goal.id] = true;
      return {
        ...s,
        goalAggregations: { ...(s.goalAggregations || {}), [tomorrow]: tomorrowAgg },
        dailyChecks: { ...(s.dailyChecks || {}), [date]: day },
      };
    });
    offerUndo(`Deferred to tomorrow: ${stripDuration(goal.label)}`, () => {
      setState((s) => {
        const tomorrowAgg = { ...(s.goalAggregations?.[tomorrow] || {}) };
        const cur = tomorrowAgg[goal.id];
        if (!cur) return s;
        if (cur.count <= 1) delete tomorrowAgg[goal.id];
        else tomorrowAgg[goal.id] = { ...cur, count: cur.count - 1 };
        const day = { ...(s.dailyChecks?.[date] || {}) };
        delete day[goal.id];
        return {
          ...s,
          goalAggregations: { ...(s.goalAggregations || {}), [tomorrow]: tomorrowAgg },
          dailyChecks: { ...(s.dailyChecks || {}), [date]: day },
        };
      });
    });
  };

  const checkAll = () =>
    setState((s) => {
      const day = {};
      (s.dailyGoals || []).forEach((g) => { day[g.id] = true; });
      return { ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: day } };
    });
  const clearAll = () =>
    setState((s) => ({
      ...s,
      dailyChecks: { ...(s.dailyChecks || {}), [date]: {} },
      goalTimers: {},
    }));

  const updateLabel = (id, label) =>
    setState((s) => ({ ...s, dailyGoals: (s.dailyGoals || []).map((g) => (g.id === id ? { ...g, label } : g)) }));
  const removeGoal = (id) => {
    let removed;
    setState((s) => {
      removed = (s.dailyGoals || []).find((g) => g.id === id);
      return { ...s, dailyGoals: (s.dailyGoals || []).filter((g) => g.id !== id) };
    });
    if (removed) offerUndo(`Removed "${removed.label}"`, () => {
      setState((s) => ({ ...s, dailyGoals: [...(s.dailyGoals || []), removed] }));
    });
  };
  const addGoal = () => {
    const label = draftLabel.trim();
    if (!label) return;
    setState((s) => ({ ...s, dailyGoals: [...(s.dailyGoals || []), { id: newId(), label }] }));
    setDraftLabel('');
  };

  const doneCount = goals.reduce((n, g) => n + (checksToday[g.id] ? 1 : 0), 0);
  const allDone = goals.length > 0 && doneCount === goals.length;
  const streak = useMemo(() => computeStreak(state.dailyChecks || {}, goals, date), [state.dailyChecks, goals, date]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-0.5">{prettyDate(date)}</p>
          <h1 className="font-display text-2xl text-chocolate leading-tight">
            {allDone ? 'All complete' : 'Daily goals'}
          </h1>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-white border border-stone rounded-md px-3 py-2 text-sm" />
      </div>

      <section className={`card p-5 transition ${allDone ? 'celebrate-glow' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display text-2xl text-chocolate">{doneCount}<span className="text-muted text-base"> / {goals.length}</span></div>
            <div className="text-xs text-muted">{streak.streak > 0 ? `${streak.streak}-day streak` : 'No streak'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={clearAll} className="btn-ghost text-xs">Clear</button>
            <button onClick={checkAll} className="btn-soft text-xs">Mark all done</button>
            <button onClick={() => setEditing((e) => !e)} className={`text-xs ${editing ? 'btn-primary' : 'btn-soft'}`}>
              {editing ? 'Done' : 'Edit list'}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-stone">
          {goals.map((g) => {
            const checked = !!checksToday[g.id];
            const duration = effectiveDurationSec(g);
            const baseDuration = parseGoalDuration(g.label);
            const aggCount = aggToday[g.id]?.count || 0;
            const timer = state.goalTimers?.[g.id];
            const isRunning = timer && timer.date === date && (now - timer.startedAt) / 1000 < timer.durationSec;
            const remaining = timer ? Math.max(0, timer.durationSec - (now - timer.startedAt) / 1000) : 0;
            // Tomorrow's existing aggregation count for this goal (cap check)
            const tomorrowAggCount = state.goalAggregations?.[tomorrow]?.[g.id]?.count || 0;
            const canDefer = baseDuration && !checked && tomorrowAggCount < 2;

            return (
              <li key={g.id} className="py-3">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <MicField value={g.label} onChange={(e) => updateLabel(g.id, e.target.value)}
                      wrapperClassName="flex-1" className="input text-sm"/>
                    <button onClick={() => removeGoal(g.id)}
                      className="text-muted hover:text-rose text-sm px-2"
                      aria-label="Remove">×</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => toggle(g.id)}
                      className="flex items-center gap-3 flex-1 text-left active:scale-[.99] transition min-w-0"
                      aria-pressed={checked}>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        checked ? 'bg-caramel border-caramel text-canvas' : 'bg-white border-stone'
                      }`}>
                        {checked && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l4 4 10-10"/>
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0">
                        <span className="text-base text-chocolate">{effectiveLabel(g)}</span>
                        {aggCount > 0 && (
                          <div className="text-[10px] text-muted">+{aggCount}× from earlier days</div>
                        )}
                      </div>
                    </button>

                    {duration && !checked && (
                      isRunning ? (
                        <button onClick={() => stopTimer(g.id)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blush text-toast text-xs font-medium recording"
                          aria-label="Stop timer">
                          <PulseDot/>
                          {fmtTime(remaining)}
                        </button>
                      ) : (
                        <button onClick={() => startTimer(g.id, duration)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-oat text-cocoa text-xs font-medium hover:bg-latte"
                          aria-label="Start timer">
                          <PlayIcon/>
                          Start
                        </button>
                      )
                    )}

                    {canDefer && (
                      <button onClick={() => deferToTomorrow(g)}
                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-stone text-cocoa text-[11px] hover:border-caramel"
                        title={tomorrowAggCount === 0
                          ? `Defer to tomorrow (you'll have one bigger session)`
                          : `Defer again — tomorrow becomes ${Math.round((parseGoalDuration(g.label) * (tomorrowAggCount + 2)) / 60)} min`}>
                        Defer →
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!goals.length && (
            <li className="py-4 text-sm text-muted italic">No goals defined. Tap "Edit list" to add.</li>
          )}
        </ul>

        {editing && (
          <div className="mt-3 flex gap-2 pt-3 border-t border-stone">
            <MicField value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
              placeholder='Add a goal — e.g. "10 minutes stretching"'
              wrapperClassName="flex-1" className="input text-sm"/>
            <button onClick={addGoal} disabled={!draftLabel.trim()} className="btn-primary text-sm">Add</button>
          </div>
        )}
      </section>

      {/* Last 7 days strip */}
      <section className="card p-5">
        <h3 className="font-display text-base text-chocolate mb-3">Last 7 days</h3>
        <Last7Days state={state} goals={goals}/>
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
            <div className={`w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium
              ${full ? 'bg-caramel text-canvas' : pct > 0 ? 'bg-blush text-cocoa' : 'bg-oat text-muted'}`}>
              {d.done}/{d.total || '–'}
            </div>
            <div className="text-[9px] text-muted">{shortDay(d.date)}</div>
          </div>
        );
      })}
    </div>
  );
}

// Helpers ---------------------------------------------------------------

function nextDay(iso) {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseGoalDuration(label) {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('h')) return Math.round(n * 3600);
  if (u.startsWith('s')) return Math.round(n);
  return Math.round(n * 60);
}
function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
function stripDuration(label) {
  return (label || '')
    .replace(/^\s*\d+(?:\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b\s*/i, '')
    .trim();
}

// 1 rest-day-per-week grace (same algorithm as the previous Home).
function computeStreak(checks, goals, fromDate) {
  if (!goals.length) return { streak: 0 };
  const allDone = (iso) => goals.every((g) => (checks[iso] || {})[g.id]);
  let streak = 0;
  const restUsedByWeek = new Set();
  const cursor = new Date(fromDate + 'T00:00');
  if (allDone(fromDate)) streak += 1;
  for (let i = 1; i <= 365; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const wk = isoWeek(d);
    if (allDone(iso)) { streak += 1; continue; }
    if (!restUsedByWeek.has(wk)) { restUsedByWeek.add(wk); continue; }
    break;
  }
  return { streak };
}
function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function shortDay(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' });
}
function PlayIcon() { return (<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>); }
function PulseDot() { return <span className="w-2 h-2 rounded-full bg-toast inline-block"/>; }
