// Picks a single short, action-oriented tip for the user's home screen
// based on what their data has been doing lately. Returns
// { text, kind, accent } where kind is a tag for analytics/styling and
// accent is one of 'positive' | 'attention' | 'neutral'.
//
// Rules are evaluated in priority order; the first matching rule wins.

import { isoDaysAgo } from './storage.js';
import { aggregatePlants } from '../data/plants.js';
import { macroTargets } from './storage.js';

export function tipForToday(state, today) {
  const goals = state.dailyGoals || [];
  const checks = state.dailyChecks || {};
  const todayChecks = checks[today] || {};
  const yesterday = isoDaysAgo(1);
  const yesterdayChecks = checks[yesterday] || {};
  const todayDone = goals.length > 0 && goals.every((g) => todayChecks[g.id]);

  const start7 = isoDaysAgo(6);
  const week = (state.foodEntries || []).filter((e) => e.date >= start7 && e.date <= today);
  const todayEntries = (state.foodEntries || []).filter((e) => e.date === today);
  const yesterdayEntries = (state.foodEntries || []).filter((e) => e.date === yesterday);

  // 1. Already perfect — celebrate, don't lecture.
  if (todayDone) {
    return { kind: 'celebration', text: 'All goals already complete today. Solid.', accent: 'positive' };
  }

  // 2. Brand-new user — don't lecture about plants/macros before there's
  //    any data to base it on.
  if (week.length < 3) {
    return {
      kind: 'first',
      text: 'Log a few meals over the next two days and your tips will get specific.',
      accent: 'neutral',
    };
  }

  // 3. Streak in progress: encourage continuation.
  const streak = currentStreak(checks, goals, today);
  if (streak >= 5) {
    return {
      kind: 'streak',
      text: `${streak}-day goal streak. Keep it alive — start with the easiest tick.`,
      accent: 'positive',
    };
  }

  // 3. A specific goal missed yesterday: call it out by name.
  if (goals.length && Object.keys(yesterdayChecks).length) {
    const missedYesterday = goals.find((g) => !yesterdayChecks[g.id]);
    if (missedYesterday && goals.some((g) => yesterdayChecks[g.id])) {
      return {
        kind: 'gap',
        text: `Yesterday you missed: ${stripDuration(missedYesterday.label)}. Get it done first today.`,
        accent: 'attention',
      };
    }
  }

  // 4. Sugar trending high.
  const sugarCap = state.goals?.sugarG || 25;
  const sugarAvg = avgPerDay(week, 'sugars');
  if (sugarAvg > sugarCap * 1.15) {
    return {
      kind: 'sugar',
      text: `Sugar's averaged ${Math.round(sugarAvg)}g/day this week, above your ${sugarCap}g cap. Pick whole-food snacks today.`,
      accent: 'attention',
    };
  }

  // 5. Protein trending low.
  const macros = macroTargets(state.profile, state.goals);
  const proteinAvg = avgPerDay(week, 'protein');
  if (proteinAvg && proteinAvg < macros.protein * 0.85) {
    return {
      kind: 'protein',
      text: `Protein's been low (~${Math.round(proteinAvg)}g/day, target ${macros.protein}g). Add eggs, Greek yoghurt, or chicken to one meal.`,
      accent: 'attention',
    };
  }

  // 6. Plants pace lagging.
  const plantsTarget = state.goals?.plantsPerWeek || 50;
  const plants = aggregatePlants(week);
  const dow = ((new Date(today + 'T00:00').getDay() + 6) % 7) + 1; // Mon=1 .. Sun=7
  const expectedByNow = (plantsTarget * dow) / 7;
  if (plants.plants.length < expectedByNow * 0.75) {
    return {
      kind: 'plants',
      text: `${plants.plants.length} plants this week — need ${plantsTarget - plants.plants.length} more to hit ${plantsTarget}. Add a new fruit or veg today.`,
      accent: 'attention',
    };
  }

  // 7. Plants pace strong.
  if (plants.plants.length >= expectedByNow * 1.1) {
    return {
      kind: 'plants-good',
      text: `${plants.plants.length} plants logged this week — ahead of pace for ${plantsTarget}. Keep variety up.`,
      accent: 'positive',
    };
  }

  // 8. Fresh day — nothing logged yet by mid-morning.
  const hour = new Date().getHours();
  if (todayEntries.length === 0 && hour >= 9) {
    return {
      kind: 'log',
      text: 'No food logged yet. Open the brand search and add breakfast.',
      accent: 'neutral',
    };
  }

  // Default — pragmatic baseline.
  return {
    kind: 'default',
    text: 'Hit your protein target, log every meal, tick three goals before lunch.',
    accent: 'neutral',
  };
}

function avgPerDay(entries, field) {
  if (!entries.length) return 0;
  const totals = {};
  for (const e of entries) {
    totals[e.date] = (totals[e.date] || 0) + (e[field] || 0);
  }
  const days = Object.keys(totals);
  if (!days.length) return 0;
  return days.reduce((s, d) => s + totals[d], 0) / days.length;
}

function currentStreak(checks, goals, today) {
  if (!goals.length) return 0;
  let streak = 0;
  const todayDone = goals.every((g) => (checks[today] || {})[g.id]);
  if (todayDone) streak += 1;
  const cursor = new Date(today + 'T00:00');
  for (let i = 1; i <= 365; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const day = checks[iso] || {};
    if (!goals.every((g) => day[g.id])) break;
    streak += 1;
  }
  return streak;
}

// Strip trailing duration descriptors so "30 min deep clean" reads as
// "deep clean" in the gap-call-out sentence.
function stripDuration(label) {
  return (label || '')
    .replace(/^\s*\d+(?:\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b\s*/i, '')
    .trim();
}
