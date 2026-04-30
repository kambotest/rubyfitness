import { useEffect, useMemo, useRef, useState } from 'react';
import { todayISO, isoDaysAgo, newId } from '../utils/storage.js';

// Daily checklist of recurring habits. Goals are editable. Per-day checks
// live in state.dailyChecks. Time-based goals (label contains a duration
// like "30 min" or "2 minutes") get an inline Start button — tap once,
// the countdown runs in wall-clock time so it survives app close /
// reload, and auto-ticks the goal on expiry.
export default function DailyGoals({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [now, setNow] = useState(Date.now());

  const goals = state.dailyGoals || [];
  const checksToday = state.dailyChecks?.[date] || {};
  const doneCount = goals.reduce((n, g) => n + (checksToday[g.id] ? 1 : 0), 0);
  const allDone = goals.length > 0 && doneCount === goals.length;

  // Tick once a second — drives countdown display and triggers timer
  // expirations. Returns same state when nothing's expired so React skips
  // the re-render.
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
          if (timer.date !== date) continue; // stale: only auto-complete same-day
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
      // Manually checking off cancels any running timer for the goal.
      const newTimers = { ...(s.goalTimers || {}) };
      if (newTimers[goalId]) delete newTimers[goalId];
      return { ...s, dailyChecks: { ...(s.dailyChecks || {}), [date]: day }, goalTimers: newTimers };
    });
  };

  const startTimer = (goalId, durationSec) => {
    setState((s) => ({
      ...s,
      goalTimers: { ...(s.goalTimers || {}), [goalId]: { startedAt: Date.now(), durationSec, date } },
    }));
  };
  const stopTimer = (goalId) => {
    setState((s) => {
      const t = { ...(s.goalTimers || {}) };
      delete t[goalId];
      return { ...s, goalTimers: t };
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
    setState((s) => ({
      ...s,
      dailyChecks: { ...(s.dailyChecks || {}), [date]: {} },
      goalTimers: {},
    }));
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

  const streak = useMemo(() => computeStreak(state.dailyChecks || {}, goals, date), [state.dailyChecks, goals, date]);

  // Celebration: fires when all goals transition from incomplete -> complete.
  // shownDates ensures we don't re-celebrate on reload of an already-complete
  // day; ref initialised to the current allDone value so opening the page
  // when everything is already ticked doesn't trigger a fresh celebration.
  const [celebrating, setCelebrating] = useState(false);
  const wasAllDoneRef = useRef(allDone);
  const [shownDates, setShownDates] = useState(() => new Set());
  useEffect(() => {
    if (allDone && !wasAllDoneRef.current && !shownDates.has(date)) {
      setCelebrating(true);
      setShownDates((prev) => { const n = new Set(prev); n.add(date); return n; });
    }
    wasAllDoneRef.current = allDone;
  }, [allDone, date]); // eslint-disable-line react-hooks/exhaustive-deps

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

      <section className={`card p-5 transition ${allDone ? 'celebrate-glow' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display text-2xl">{doneCount}<span className="text-muted text-base"> / {goals.length}</span></div>
            <div className="text-xs text-muted">{prettyDate(date)} · {streak > 0 ? `${streak}-day streak` : 'No streak'}</div>
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
            const duration = parseGoalDuration(g.label);
            const timer = state.goalTimers?.[g.id];
            const isRunning = timer && timer.date === date && (now - timer.startedAt) / 1000 < timer.durationSec;
            const remaining = timer ? Math.max(0, timer.durationSec - (now - timer.startedAt) / 1000) : 0;

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
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(g.id)}
                      className="flex items-center gap-3 flex-1 text-left active:scale-[.99] transition min-w-0"
                      aria-pressed={checked}>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        checked ? 'bg-moss border-moss text-cream' : 'bg-white border-sand'
                      }`}>
                        {checked && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l4 4 10-10"/>
                          </svg>
                        )}
                      </span>
                      <span className="text-base text-ink truncate">{g.label}</span>
                    </button>

                    {duration && !checked && (
                      isRunning ? (
                        <button onClick={() => stopTimer(g.id)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose/15 text-rose text-xs font-medium hover:bg-rose/25"
                          aria-label="Stop timer">
                          <PulseDot/>
                          {fmtTime(remaining)}
                        </button>
                      ) : (
                        <button onClick={() => startTimer(g.id, duration)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sand text-plum text-xs font-medium hover:bg-clay/30"
                          aria-label="Start timer">
                          <PlayIcon/>
                          Start
                        </button>
                      )
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
          <div className="mt-3 flex gap-2 pt-3 border-t border-sand">
            <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
              placeholder='Add a goal — e.g. "10 minutes stretching"'
              className="input flex-1 text-sm"/>
            <button onClick={addGoal} disabled={!draftLabel.trim()} className="btn-primary text-sm">Add</button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="font-display text-lg mb-3">Last 7 days</h3>
        <Last7Days state={state} goals={goals} />
      </section>

      {celebrating && (
        <Celebration streak={streak} onClose={() => setCelebrating(false)} />
      )}
    </div>
  );
}

// ---- Sub-components ----

function Celebration({ streak, onClose }) {
  // 36 confetti pieces — generated once with random colour, x-position,
  // horizontal drift, delay and duration so the result feels natural.
  const pieces = useMemo(() => Array.from({ length: 36 }, () => ({
    left: Math.random() * 100,
    drift: (Math.random() - 0.5) * 60,
    color: ['#5E7257', '#D9A6A1', '#C9A98C', '#8FA487', '#6B4F60', '#F2EADF'][Math.floor(Math.random() * 6)],
    delay: Math.random() * 0.4,
    duration: 1.5 + Math.random() * 1.2,
  })), []);

  // Auto-dismiss after 6s if the user doesn't tap.
  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="All goals complete">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      {pieces.map((p, i) => (
        <span key={i} className="confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
          }}/>
      ))}
      <div className="card relative pop-in p-6 max-w-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-moss text-cream flex items-center justify-center mb-3">
          <svg className="tick-draw" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4 10-10"/>
          </svg>
        </div>
        <h2 className="font-display text-2xl mb-1">All goals complete</h2>
        <p className="text-sm text-muted">
          {streak > 1 ? `${streak}-day streak.` : 'First day in a row.'}
        </p>
        <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
      </div>
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

// ---- Helpers ----

// Extract a duration in seconds from a goal label.
// Accepts: "30 min", "30 mins", "30 minute(s)", "1 hr", "1 hour", "45 sec".
export function parseGoalDuration(label) {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('h')) return Math.round(n * 3600);
  if (u.startsWith('s')) return Math.round(n);
  return Math.round(n * 60); // default: minutes
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function computeStreak(checks, goals, fromDate) {
  if (!goals.length) return 0;
  let streak = 0;
  const today = checks[fromDate] || {};
  const todayAllDone = goals.every((g) => today[g.id]);
  if (todayAllDone) streak += 1;
  const cursor = new Date(fromDate + 'T00:00');
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

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8z"/>
    </svg>
  );
}
function PulseDot() {
  return <span className="w-2 h-2 rounded-full bg-rose recording inline-block"/>;
}
