import { useState } from 'react';

// Compact hydration counter for the Home screen. Defaults to 250mL per
// glass (a standard cup). Tap to add a glass; long-press / tap the
// number to choose a different volume. Stored as state.hydration[date]
// = { ml }. Counts water, tea, coffee, sparkling water — anything you
// drink for fluid balance.
export default function Hydration({ value = 0, target = 2500, onAdd, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const glasses = Math.round(value / 250);
  const targetGlasses = Math.round(target / 250);

  const submitDraft = () => {
    const ml = Math.max(0, parseInt(draft, 10) || 0);
    onSet?.(ml);
    setEditing(false);
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-sage/15 text-moss flex items-center justify-center shrink-0">
            <DropIcon/>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted">Hydration</p>
            {editing ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitDraft(); if (e.key === 'Escape') setEditing(false); }}
                  type="number" inputMode="numeric" autoFocus
                  className="input py-1 px-2 text-sm w-24"/>
                <span className="text-xs text-muted">mL</span>
                <button onClick={submitDraft} className="btn-primary text-xs h-7 px-2">OK</button>
              </div>
            ) : (
              <button onClick={() => { setDraft(String(value)); setEditing(true); }}
                className="font-display text-xl text-ink hover:text-plum text-left"
                aria-label="Set exact hydration">
                {value} <span className="text-sm text-muted">mL · {glasses} / {targetGlasses} glasses</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <QuickAdd label="+250" onClick={() => onAdd?.(250)} />
          <QuickAdd label="+500" onClick={() => onAdd?.(500)} />
          {value >= 250 && <QuickAdd label="−250" onClick={() => onAdd?.(-250)} subdued />}
        </div>
      </div>

      <div className="h-2 rounded-full bg-sand overflow-hidden mt-3">
        <div className="h-full bg-sage transition-all duration-300"
          style={{ width: `${pct * 100}%` }}/>
      </div>
    </section>
  );
}

function QuickAdd({ label, onClick, subdued }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-full text-sm font-medium border transition active:scale-95 ${
        subdued ? 'bg-white/70 border-sand text-muted hover:text-plum' : 'bg-sage/15 border-sage/30 text-moss hover:bg-sage/25'
      }`}>
      {label}
    </button>
  );
}

function DropIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l5 7a6 6 0 1 1-10 0z"/>
    </svg>
  );
}
