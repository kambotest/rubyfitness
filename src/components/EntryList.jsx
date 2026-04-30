export function FoodEntryList({ entries, onDelete, onEdit }) {
  if (!entries.length) return <Empty text="Nothing logged yet today. Speak or type your first bite." />;
  return (
    <ul className="divide-y divide-sand/70">
      {entries.map((e) => (
        <li key={e.id} className="py-2.5 flex items-start gap-1">
          <button onClick={() => onEdit?.(e)}
            className="flex-1 flex items-start gap-3 text-left rounded-xl px-1.5 py-0.5 -mx-1.5 hover:bg-sand/40 active:bg-sand/60 transition min-w-0"
            aria-label={`Edit ${e.name}`}>
            <div className="w-9 h-9 rounded-full bg-sand text-plum text-xs flex items-center justify-center font-medium uppercase shrink-0">
              {(e.meal || 'meal')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium truncate">{e.name}</div>
                <div className="text-sm text-plum whitespace-nowrap">{e.kcal} kcal</div>
              </div>
              <div className="text-xs text-muted">
                {fmtAmount(e)} · {e.protein}p · {e.carbs}c · {e.fat}f
              </div>
            </div>
          </button>
          <button onClick={() => onDelete(e.id)} className="text-muted hover:text-rose text-xs px-2 py-1 shrink-0" aria-label="Delete">×</button>
        </li>
      ))}
    </ul>
  );
}

export function ExerciseEntryList({ entries, onDelete }) {
  if (!entries.length) return <Empty text="No movement logged yet. Walking with the pram counts!" />;
  return (
    <ul className="divide-y divide-sand/70">
      {entries.map((e) => (
        <li key={e.id} className="py-2.5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-sage/20 text-moss flex items-center justify-center shrink-0">
            <RunIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-medium truncate">{e.name}</div>
              <div className="text-sm text-plum whitespace-nowrap">−{e.kcal} kcal</div>
            </div>
            <div className="text-xs text-muted">
              {e.minutes} min{e.km ? ` · ${e.km} km` : ''}
            </div>
          </div>
          <button onClick={() => onDelete(e.id)} className="text-muted hover:text-rose text-xs px-2 py-1">×</button>
        </li>
      ))}
    </ul>
  );
}

function fmtAmount(e) {
  if (e.unit === 'piece') return `${e.amount} ${e.amount === 1 ? 'piece' : 'pieces'}`;
  return `${e.amount} ${e.unit}`;
}

function Empty({ text }) {
  return <div className="text-sm text-muted italic py-3">{text}</div>;
}

function RunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2"/><path d="M4 22l5-9 4 3 3-5 4 3"/>
    </svg>
  );
}
