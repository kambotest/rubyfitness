import { useEffect, useMemo, useRef, useState } from 'react';
import { todayISO, isoDaysAgo, isoWeek, newId } from '../utils/storage.js';
import { quoteForDate } from '../data/quotes.js';
import { tipForToday } from '../utils/tips.js';
import WeeklyCheckIn from './WeeklyCheckIn.jsx';
import MicField from './MicField.jsx';
import { useUndo } from './UndoToast.jsx';

// Landing screen. Shows the brand wordmark, today's data-driven tip,
// a daily-rotating quote, and the full goal checklist (with timers and
// the all-complete celebration). All goal interactions live here —
// there is no separate Goals tab.
export default function Home({ state, setState }) {
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [now, setNow] = useState(Date.now());

  const { offerUndo } = useUndo();
  const goals = state.dailyGoals || [];
  const checksToday = state.dailyChecks?.[date] || {};
  const doneCount = goals.reduce((n, g) => n + (checksToday[g.id] ? 1 : 0), 0);
  const allDone = goals.length > 0 && doneCount === goals.length;

  const tip = useMemo(() => tipForToday(state, date), [state, date]);
  const quote = useMemo(() => quoteForDate(date), [date]);

  // Weekly check-in: opens once per ISO week on Sundays (or first time
  // the user opens it after a Sunday). Dismissible — never re-opens for
  // the same week.
  const thisWeek = isoWeek(new Date(date + 'T00:00'));
  const dayOfWeek = new Date(date + 'T00:00').getDay(); // 0 = Sun
  const showWeeklyCheckIn = (state.weeklyCheckIn?.lastShownIsoWeek !== thisWeek) && dayOfWeek === 0;
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  useEffect(() => {
    if (showWeeklyCheckIn) setWeeklyOpen(true);
  }, [showWeeklyCheckIn]);
  const dismissWeekly = () => {
    setWeeklyOpen(false);
    setState((s) => ({ ...s, weeklyCheckIn: { ...(s.weeklyCheckIn || {}), lastShownIsoWeek: thisWeek } }));
  };

  // 1Hz tick — drives countdown displays and timer expirations. Same
  // state object is returned when nothing's expired so React skips.
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

  const { streak, restAvailableThisWeek } = useMemo(
    () => computeStreak(state.dailyChecks || {}, goals, date),
    [state.dailyChecks, goals, date]
  );

  // Celebration: only on a fresh transition, only once per (date, session).
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
      {/* Wordmark hero */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted mb-0.5">{prettyDate(date)}</p>
          <h1 className="brand-mark text-3xl sm:text-4xl text-ink leading-tight">
            <span className="text-charcoal">Built</span><span className="text-dusty">Different</span>
          </h1>
          {state.profile.name && (
            <p className="text-sm text-muted mt-1">{greetingFor(state.profile.name)}</p>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-white/70 border border-sand rounded-xl px-3 py-2 text-sm" />
      </header>

      {/* Today's tip */}
      {tip && (
        <section className={`card p-4 sm:p-5 border-l-4 ${
          tip.accent === 'positive' ? 'border-rose' :
          tip.accent === 'attention' ? 'border-coral' : 'border-mushroom'
        }`}>
          <div className="flex items-start gap-3">
            <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              tip.accent === 'positive' ? 'bg-blush text-dusty' :
              tip.accent === 'attention' ? 'bg-peach text-coral' : 'bg-linen text-charcoal'
            }`}>
              <TipIcon accent={tip.accent}/>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted">Today's focus</p>
              <p className="text-sm sm:text-base text-ink leading-snug">{tip.text}</p>
            </div>
          </div>
        </section>
      )}

      {/* Goals checklist */}
      <section className={`card p-5 transition ${allDone ? 'celebrate-glow' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Daily goals</p>
            <div className="font-display text-2xl">{doneCount}<span className="text-muted text-base"> / {goals.length}</span></div>
            <div className="text-xs text-muted">
              {streak > 0 ? `${streak}-day streak` : 'No streak'}
              {streak > 0 && (
                <span className={`ml-2 ${restAvailableThisWeek ? 'text-moss' : 'text-mushroom'}`}>
                  · {restAvailableThisWeek ? 'rest day available' : 'rest day used'}
                </span>
              )}
            </div>
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
                    <MicField value={g.label} onChange={(e) => updateLabel(g.id, e.target.value)}
                      wrapperClassName="flex-1" className="input text-sm"/>
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
                        checked ? 'bg-dusty border-dusty text-canvas' : 'bg-white border-stone'
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
            <MicField value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
              placeholder='Add a goal — e.g. "10 minutes stretching"'
              wrapperClassName="flex-1" className="input text-sm"/>
            <button onClick={addGoal} disabled={!draftLabel.trim()} className="btn-primary text-sm">Add</button>
          </div>
        )}
      </section>

      {/* Daily quote */}
      {quote && (
        <section className="card p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Today</p>
          <blockquote className="font-display text-lg sm:text-xl text-ink leading-snug">
            “{quote.text}”
          </blockquote>
          <p className="text-xs text-muted mt-2">— {quote.author}</p>
        </section>
      )}

      {/* Last 7 days */}
      <section className="card p-5">
        <h3 className="font-display text-lg mb-3">Last 7 days</h3>
        <Last7Days state={state} goals={goals} />
      </section>

      {celebrating && <Celebration streak={streak} onClose={() => setCelebrating(false)} />}
      {weeklyOpen && (
        <WeeklyCheckIn state={state} setState={setState} onClose={dismissWeekly} today={date} />
      )}
    </div>
  );
}

// ---- Sub-components ----

function Celebration({ streak, onClose }) {
  const pieces = useMemo(() => Array.from({ length: 36 }, () => ({
    left: Math.random() * 100,
    drift: (Math.random() - 0.5) * 60,
    color: ['#C99097', '#E5B7B3', '#E0A38B', '#E5C28A', '#F5DAD7', '#F5D9C0', '#FBE8E4', '#F5E8C0', '#DDD3E8', '#C5DCE5'][Math.floor(Math.random() * 10)],
    delay: Math.random() * 0.4,
    duration: 1.5 + Math.random() * 1.2,
  })), []);

  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="All goals complete">
      <div className="absolute inset-0 overlay" onClick={onClose}/>
      {pieces.map((p, i) => (
        <span key={i} className="confetti"
          style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, '--drift': `${p.drift}px` }}/>
      ))}
      <div className="card relative pop-in p-6 max-w-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-dusty text-canvas flex items-center justify-center mb-3">
          <svg className="tick-draw" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4 10-10"/>
          </svg>
        </div>
        <h2 className="font-display text-2xl mb-1">All goals complete</h2>
        <p className="text-sm text-muted">{streak > 1 ? `${streak}-day streak.` : 'First day in a row.'}</p>
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
              ${full ? 'bg-dusty text-canvas' : pct > 0 ? 'bg-blush text-charcoal' : 'bg-linen text-muted'}`}>
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
// Streak counter with one-rest-day-per-ISO-week grace. Walks backwards
// day by day from `fromDate`. A complete day always extends the streak;
// an incomplete day is absorbed once per ISO week (the first time we
// encounter one in that week). The second incomplete day in the same
// week breaks the streak. Returns { streak, restAvailableThisWeek } so
// the UI can surface whether a grace day is still in the bank.
function computeStreak(checks, goals, fromDate) {
  if (!goals.length) return { streak: 0, restAvailableThisWeek: false };
  const allDone = (iso) => goals.every((g) => (checks[iso] || {})[g.id]);

  let streak = 0;
  const restUsedByWeek = new Set();
  const cursor = new Date(fromDate + 'T00:00');

  // Today first
  if (allDone(fromDate)) {
    streak += 1;
  } else {
    // Today's not done — eligible to be the rest day for this ISO week,
    // but only if the user has logged at least *some* progress today;
    // otherwise we don't want a brand-new day to be "spent" silently.
    // We still check the streak-rest rule though so prior days carry.
  }

  for (let i = 1; i <= 365; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const wk = isoWeek(d);
    if (allDone(iso)) {
      streak += 1;
      continue;
    }
    if (!restUsedByWeek.has(wk)) {
      restUsedByWeek.add(wk);
      // Rest day absorbs this incomplete day; streak continues but the
      // skipped day is NOT counted.
      continue;
    }
    break;
  }

  // Did we use the rest day for THIS week already?
  const thisWeek = isoWeek(new Date(fromDate + 'T00:00'));
  const restAvailableThisWeek = !restUsedByWeek.has(thisWeek);
  return { streak, restAvailableThisWeek };
}
function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function shortDay(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' });
}
function greetingFor(name) {
  const h = new Date().getHours();
  const tod = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${tod}, ${name}.`;
}

function PlayIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>);
}
function PulseDot() {
  return <span className="w-2 h-2 rounded-full bg-rose recording inline-block"/>;
}
function TipIcon({ accent }) {
  if (accent === 'positive') {
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4 10-10"/>
    </svg>);
  }
  if (accent === 'attention') {
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5"/><circle cx="12" cy="17" r="0.5"/>
    </svg>);
  }
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17V7"/><circle cx="12" cy="4.5" r="0.5"/>
  </svg>);
}
