import { useMemo } from 'react';
import { isoDaysAgo, dailyCalorieTarget, macroTargets } from '../utils/storage.js';
import { aggregatePlants } from '../data/plants.js';

// Sunday-morning weekly digest. One-screen summary of the past 7 days,
// plus a couple of "Adjust" CTAs that update goals in place. Triggered
// by Home.jsx when state.weeklyCheckIn.lastShownIsoWeek doesn't match
// the current week.
//
// Stats shown:
//   - Weight delta vs prior week
//   - Goal completion (full days complete out of 7)
//   - Average daily kcal vs target
//   - Average daily protein/sugar/fibre
//   - Distinct plants this week vs target
//   - Hydration average vs target
//   - Top 3 most-logged brand items
//   - Suggested adjustments (if patterns are off)
export default function WeeklyCheckIn({ state, setState, onClose, today }) {
  const data = useMemo(() => computeStats(state, today), [state, today]);
  const macros = useMemo(() => macroTargets(state.profile, state.goals), [state.profile, state.goals]);
  const target = dailyCalorieTarget(state.profile, state.goals);
  const suggestions = useMemo(() => buildSuggestions(state, data, macros, target), [state, data, macros, target]);

  const adjust = (path, value) => {
    setState((s) => {
      const next = { ...s };
      if (path === 'sugarG') next.goals = { ...s.goals, sugarG: value };
      if (path === 'proteinG') next.goals = { ...s.goals, proteinG: value };
      if (path === 'plantsPerWeek') next.goals = { ...s.goals, plantsPerWeek: value };
      if (path === 'hydrationMl') next.goals = { ...s.goals, hydrationMl: value };
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 overlay flex items-end sm:items-center justify-center p-2"
         onClick={onClose}>
      <div className="card w-full max-w-md p-4 sm:p-5 fade-up max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Weekly check-in</p>
            <h3 className="font-display text-xl">{prettyRange(data.startIso, data.endIso)}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-plum text-sm" aria-label="Close">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Stat label="Weight delta" value={data.weightDelta != null ? `${data.weightDelta > 0 ? '+' : ''}${data.weightDelta.toFixed(1)} kg` : '—'}
                sub={data.weightDelta != null ? 'vs last week' : 'log a weigh-in'}
                accent={data.weightDelta != null && data.weightDelta < 0 ? 'positive' : 'neutral'}/>
          <Stat label="Goals" value={`${data.fullCompleteDays} / 7`} sub="full days complete"
                accent={data.fullCompleteDays >= 5 ? 'positive' : data.fullCompleteDays >= 3 ? 'neutral' : 'attention'}/>
          <Stat label="Avg kcal" value={Math.round(data.avgKcal)} sub={`target ${target}`}
                accent={Math.abs(data.avgKcal - target) < target * 0.1 ? 'positive' : 'attention'}/>
          <Stat label="Avg protein" value={`${Math.round(data.avgProtein)}g`} sub={`target ${macros.protein}g`}
                accent={data.avgProtein >= macros.protein * 0.9 ? 'positive' : 'attention'}/>
          <Stat label="Avg free sugar" value={`${Math.round(data.avgFreeSugar)}g`} sub={`cap ${state.goals?.sugarG || 25}g`}
                accent={data.avgFreeSugar <= (state.goals?.sugarG || 25) * 1.05 ? 'positive' : 'attention'}/>
          <Stat label="Plants" value={data.plantCount} sub={`target ${state.goals?.plantsPerWeek || 50}`}
                accent={data.plantCount >= (state.goals?.plantsPerWeek || 50) * 0.85 ? 'positive' : 'attention'}/>
          <Stat label="Avg hydration" value={`${Math.round(data.avgHydration)} mL`} sub={`target ${state.goals?.hydrationMl || 2500}`}
                accent={data.avgHydration >= (state.goals?.hydrationMl || 2500) * 0.85 ? 'positive' : 'attention'}/>
          <Stat label="Avg fibre" value={`${Math.round(data.avgFiber)}g`} sub={`target ${macros.fiber}g`}
                accent={data.avgFiber >= macros.fiber * 0.85 ? 'positive' : 'neutral'}/>
        </div>

        {data.topBrands.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Most logged</p>
            <div className="flex flex-wrap gap-1.5">
              {data.topBrands.map((b) => (
                <span key={b.name} className="chip bg-sand text-plum">
                  {b.name} <span className="text-muted ml-1">×{b.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Suggested adjustments</p>
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="rounded-xl bg-cream/80 border border-sand p-3 text-sm text-ink">
                  <div className="mb-2">{s.text}</div>
                  {s.action && (
                    <button onClick={() => { adjust(s.action.path, s.action.value); }}
                      className="btn-soft text-xs">{s.action.label}</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end mt-2">
          <button onClick={onClose} className="btn-primary text-sm">Looks right</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const tone = accent === 'positive' ? 'border-moss/40' : accent === 'attention' ? 'border-rose/40' : 'border-sand';
  return (
    <div className={`rounded-xl bg-white/80 border ${tone} px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-xl text-ink">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function computeStats(state, today) {
  const startIso = isoDaysAgo(6);
  const endIso = today;
  const startIso14 = isoDaysAgo(13);

  const week = (state.foodEntries || []).filter((e) => e.date >= startIso && e.date <= endIso && !e.needsMacros);
  const days = uniqueDays(week);
  const dayCount = Math.max(1, days.length);

  const totals = week.reduce(
    (acc, e) => {
      acc.kcal += e.kcal || 0;
      acc.protein += e.protein || 0;
      acc.sugar += e.sugars || 0;
      acc.freeSugar += (e.freeSugars != null ? e.freeSugars : (e.sugars || 0));
      acc.fiber += e.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, sugar: 0, freeSugar: 0, fiber: 0 }
  );

  const goals = state.dailyGoals || [];
  let fullCompleteDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = isoDaysAgo(i);
    const checks = state.dailyChecks?.[d] || {};
    if (goals.length && goals.every((g) => checks[g.id])) fullCompleteDays += 1;
  }

  const plants = aggregatePlants(week);

  const hydrationDays = [];
  for (let i = 0; i < 7; i++) {
    const d = isoDaysAgo(i);
    hydrationDays.push(state.hydration?.[d]?.ml || 0);
  }
  const avgHydration = hydrationDays.reduce((a, b) => a + b, 0) / 7;

  // Weight delta = avg of last 7 days vs prior 7 days, where weights exist.
  const weights = (state.weights || []).map((w) => ({ ...w }));
  const recentAvg = avgWeightInRange(weights, startIso, endIso);
  const priorAvg = avgWeightInRange(weights, startIso14, isoDaysAgo(7));
  const weightDelta = (recentAvg && priorAvg) ? recentAvg - priorAvg : null;

  // Top brands by frequency (only branded, named items)
  const brandFreq = {};
  for (const e of week) {
    if (!e.brandFoodId) continue;
    brandFreq[e.name] = (brandFreq[e.name] || 0) + 1;
  }
  const topBrands = Object.entries(brandFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  return {
    startIso, endIso,
    avgKcal: totals.kcal / dayCount,
    avgProtein: totals.protein / dayCount,
    avgSugar: totals.sugar / dayCount,
    avgFreeSugar: totals.freeSugar / dayCount,
    avgFiber: totals.fiber / dayCount,
    avgHydration,
    plantCount: plants.plants.length,
    fullCompleteDays,
    weightDelta,
    topBrands,
  };
}

function buildSuggestions(state, data, macros, target) {
  const out = [];
  const sugarCap = state.goals?.sugarG || 25;
  const plantsTarget = state.goals?.plantsPerWeek || 50;
  const hydrationTarget = state.goals?.hydrationMl || 2500;

  if (data.avgFreeSugar > sugarCap * 1.2) {
    out.push({
      text: `Free sugar averaged ${Math.round(data.avgFreeSugar)}g — well above your ${sugarCap}g cap. Hold the cap or raise it slightly while you adjust.`,
    });
  }
  if (data.avgProtein < macros.protein * 0.85) {
    const newTarget = Math.round(macros.protein * 0.95);
    out.push({
      text: `Protein averaged ${Math.round(data.avgProtein)}g — short of the ${macros.protein}g target. Lower the target temporarily?`,
      action: { label: `Set protein to ${newTarget}g`, path: 'proteinG', value: newTarget },
    });
  }
  if (data.plantCount < plantsTarget * 0.6) {
    const realistic = Math.max(20, Math.round(data.plantCount * 1.5));
    out.push({
      text: `${data.plantCount} plants this week against a ${plantsTarget} target. Lower the target to ${realistic} and rebuild?`,
      action: { label: `Set plants to ${realistic}/week`, path: 'plantsPerWeek', value: realistic },
    });
  }
  if (data.avgHydration < hydrationTarget * 0.6) {
    out.push({
      text: `Hydration averaged ${Math.round(data.avgHydration)} mL/day. Add a glass with each meal — easiest cue.`,
    });
  }
  if (data.fullCompleteDays === 7) {
    out.push({ text: '7-of-7 goal completion. Consider adding a sixth goal to keep it stretching.' });
  } else if (data.fullCompleteDays === 0) {
    out.push({ text: 'No fully-complete goal days this week. Edit the list down to two non-negotiables and ramp back up.' });
  }
  return out;
}

function avgWeightInRange(weights, startIso, endIso) {
  const inRange = weights.filter((w) => w.date >= startIso && w.date <= endIso);
  if (!inRange.length) return null;
  return inRange.reduce((a, w) => a + w.kg, 0) / inRange.length;
}

function uniqueDays(entries) {
  const s = new Set(entries.map((e) => e.date));
  return [...s];
}

function prettyRange(startIso, endIso) {
  const opts = { day: 'numeric', month: 'short' };
  const a = new Date(startIso + 'T00:00').toLocaleDateString(undefined, opts);
  const b = new Date(endIso + 'T00:00').toLocaleDateString(undefined, opts);
  return `${a} – ${b}`;
}
