import { useEffect, useMemo, useState } from 'react';
import VoiceInput from './VoiceInput.jsx';
import Ring from './Rings.jsx';
import { todayISO, isoDaysAgo, isoWeek, newId, dailyCalorieTarget, macroTargets } from '../utils/storage.js';
import { quoteForDate } from '../data/quotes.js';
import { factForDate, shouldShowFactToday } from '../data/sciFacts.js';
import { aggregatePlants } from '../data/plants.js';
import { parseFoodTranscript, parseExerciseTranscript, classifyTranscript } from '../utils/parser.js';
import { useUndo } from './UndoToast.jsx';

// Landing screen. One unified entry surface, a daily quote OR
// science fact, then progress rings.
export default function Home({ state, setState }) {
  const [date] = useState(todayISO());
  const { offerUndo } = useUndo();

  const profileName = (state.profile?.name || '').trim();
  const greeting = profileName
    ? `Welcome back, ${profileName}.`
    : 'Welcome back.';
  const tagline = "Are you built different?";

  // Auto-classify food vs exercise from a single text/voice field.
  const submit = (text) => {
    if (!text) return;
    const cls = classifyTranscript(text);
    if (cls === 'exercise') {
      const ex = parseExerciseTranscript(text, state.profile.weightKg);
      if (ex && !ex.unknown) {
        const entry = { id: newId(), date, ...ex };
        setState((s) => ({ ...s, exerciseEntries: [...s.exerciseEntries, entry] }));
        offerUndo(`Logged ${ex.name}, ${ex.minutes} min`, () => {
          setState((s) => ({ ...s, exerciseEntries: s.exerciseEntries.filter((e) => e.id !== entry.id) }));
        });
        return;
      }
    }
    // Food path
    const items = parseFoodTranscript(text);
    if (!items.length) return;
    const meal = mealNow();
    const ok = items.filter((i) => !i.unknown).map((i) => ({ id: newId(), date, meal, ...i }));
    if (ok.length) {
      setState((s) => ({ ...s, foodEntries: [...s.foodEntries, ...ok] }));
      offerUndo(
        ok.length === 1 ? `Logged ${ok[0].name}` : `Logged ${ok.length} items`,
        () => setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => !ok.some((x) => x.id === e.id)) }))
      );
    }
  };

  // Daily quote / science fact selection.
  const showFact = shouldShowFactToday(date);
  const quote = quoteForDate(date);
  const fact = factForDate(date);

  // Today's totals for the rings.
  const dayFood = useMemo(() => state.foodEntries.filter((e) => e.date === date), [state.foodEntries, date]);
  const dayEx   = useMemo(() => state.exerciseEntries.filter((e) => e.date === date), [state.exerciseEntries, date]);
  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, freeSugars: 0 };
    dayFood.forEach((e) => {
      t.kcal += e.kcal; t.protein += e.protein; t.carbs += e.carbs;
      t.fat += e.fat; t.fiber += e.fiber;
      t.sugars += (e.sugars || 0);
      t.freeSugars += (e.freeSugars != null ? e.freeSugars : (e.sugars || 0));
    });
    return t;
  }, [dayFood]);
  const burned = useMemo(() => dayEx.reduce((s, e) => s + e.kcal, 0), [dayEx]);

  const target = dailyCalorieTarget(state.profile, state.goals);
  const macros = macroTargets(state.profile, state.goals);
  const proteinT = macros.protein;
  const fiberT = macros.fiber;
  const sugarT = macros.sugar;

  const weekPlants = useMemo(() => {
    const start = isoDaysAgo(6);
    const weekEntries = state.foodEntries.filter((e) => e.date >= start && e.date <= date);
    return aggregatePlants(weekEntries);
  }, [state.foodEntries, date]);
  const plantsTarget = state.goals?.plantsPerWeek || 50;

  const hydrationToday = state.hydration?.[date]?.ml || 0;
  const hydrationTarget = state.goals?.hydrationMl || 2500;

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <header className="text-center pt-2 pb-1">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">{prettyDate(date)}</p>
        <h1 className="brand-mark text-3xl sm:text-4xl text-chocolate leading-tight">{greeting}</h1>
        <p className="font-display text-base sm:text-lg text-caramel italic mt-1">{tagline}</p>
      </header>

      {/* Unified log entry — voice + text, auto-classifies */}
      <VoiceInput onSubmit={submit} placeholder='Log food or exercise — e.g. "150g chicken, 1 cup rice" or "ran 5km"' />

      {/* Quote OR science fact */}
      {showFact && fact ? (
        <section className="card p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Today · {fact.tag}</p>
          <p className="text-base sm:text-lg text-chocolate leading-snug">{fact.text}</p>
        </section>
      ) : quote && (
        <section className="card p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Today</p>
          <blockquote className="font-serif text-lg sm:text-xl text-chocolate leading-snug">
            “{quote.text}”
          </blockquote>
          <p className="text-xs text-muted mt-2">— {quote.author}</p>
        </section>
      )}

      {/* Progress rings */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base text-chocolate">Today</h2>
            <p className="text-xs text-muted">{Math.max(0, target - totals.kcal + burned)} kcal remaining</p>
          </div>
          <p className="text-xs text-muted">{burned > 0 ? `${burned} burned` : ''}</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-4">
          <Ring value={totals.kcal}    target={target}   label="Calories" sub="kcal"             color="#C19A6B"/>
          <Ring value={totals.protein} target={proteinT} label="Protein"  sub="g"                color="#A47551"/>
          <Ring value={totals.fiber}   target={fiberT}   label="Fibre"    sub="g"                color="#D4A574"/>
          <Ring value={Math.round(totals.freeSugars * 10) / 10} target={sugarT} label="Free sugar"
            sub={`/ ${sugarT}g cap`}
            color={totals.freeSugars >= sugarT ? '#8B6F47' : '#F2DFC9'}/>
          <Ring value={weekPlants.plants.length} target={plantsTarget}
            label="Plants" sub="this week" color="#C8D3B8"/>
          <Ring value={hydrationToday} target={hydrationTarget}
            label="Water" sub="mL" color="#C5D0CC"/>
        </div>
      </section>
    </div>
  );
}

function mealNow() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}
function prettyDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
