import { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import Dashboard from './components/Dashboard.jsx';
import Progress from './components/Progress.jsx';
import Recipes from './components/Recipes.jsx';
import Settings from './components/Settings.jsx';
import { load, save } from './utils/storage.js';
import { checkAndFire } from './utils/notifications.js';
import { registerCustomFoods } from './data/foods.js';
import { UndoProvider } from './components/UndoToast.jsx';

const TABS = [
  { id: 'today',    label: 'Today',    icon: TodayIcon },
  { id: 'home',     label: 'Home',     icon: HomeIcon },
  { id: 'progress', label: 'Progress', icon: ProgressIcon },
  { id: 'recipes',  label: 'Recipes',  icon: RecipeIcon },
  { id: 'settings', label: 'You',      icon: SelfIcon },
];

export default function App() {
  const [state, setState] = useState(load);
  const [tab, setTab] = useState('today');

  useEffect(() => { save(state); }, [state]);

  useEffect(() => { registerCustomFoods(state.customFoods); }, [state.customFoods]);

  useEffect(() => {
    const tick = () => checkAndFire(state);
    tick();
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [state]);

  return (
    <UndoProvider>
      <div className="min-h-full pb-32">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
          {tab === 'today'    && <Dashboard state={state} setState={setState} />}
          {tab === 'home'     && <Home      state={state} setState={setState} />}
          {tab === 'progress' && <Progress  state={state} setState={setState} />}
          {tab === 'recipes'  && <Recipes   state={state} setState={setState} />}
          {tab === 'settings' && <Settings  state={state} setState={setState} />}
        </main>

        <nav className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30
                        bg-white/90 backdrop-blur border border-stone rounded-full shadow-whisper
                        px-2 py-1.5 flex items-center gap-1 max-w-md sm:w-[28rem] mx-auto"
          style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full transition
                  ${active ? 'bg-dusty text-canvas' : 'text-charcoal hover:bg-blush/40'}`}>
                <Icon active={active}/>
                <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </UndoProvider>
  );
}

function HomeIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>
  </svg>);
}
function TodayIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  </svg>);
}
function ProgressIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>
  </svg>);
}
function RecipeIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v6a6 6 0 0 1-12 0z"/><path d="M9 21h6"/><path d="M12 15v6"/>
  </svg>);
}
function SelfIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>
  </svg>);
}
