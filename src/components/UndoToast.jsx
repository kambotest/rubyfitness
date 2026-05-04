import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Lightweight undo system. Wrap the app in <UndoProvider> and call
// useUndo() to surface a tap-to-undo toast after a destructive action.
//
//   const { offerUndo } = useUndo();
//   const removeFoodWithUndo = (id) => {
//     const removed = state.foodEntries.find((e) => e.id === id);
//     setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) }));
//     offerUndo(`Removed ${removed.name}`, () => {
//       setState((s) => ({ ...s, foodEntries: [...s.foodEntries, removed] }));
//     });
//   };
//
// One toast at a time. Tapping Undo restores the previous state and
// dismisses the toast. Otherwise it auto-dismisses after 4 seconds.

const UndoContext = createContext({ offerUndo: () => {} });

export function UndoProvider({ children }) {
  const [toast, setToast] = useState(null); // { id, label, undo }
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const offerUndo = useCallback((label, undo) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: Date.now(), label, undo });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleUndo = () => {
    if (!toast) return;
    try { toast.undo?.(); } catch { /* ignore */ }
    dismiss();
  };

  return (
    <UndoContext.Provider value={{ offerUndo }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 z-40 bottom-24 sm:bottom-20 max-w-sm w-[calc(100%-2rem)]
                     bg-charcoal text-canvas rounded-2xl px-4 py-3 shadow-soft
                     flex items-center justify-between gap-3 fade-up"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <span className="text-sm flex-1 truncate">{toast.label}</span>
          <button onClick={handleUndo}
            className="text-sm font-semibold text-petal hover:text-blush transition active:scale-95">
            Undo
          </button>
          <button onClick={dismiss} aria-label="Dismiss"
            className="text-canvas/60 hover:text-canvas text-lg leading-none px-1">×</button>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}
