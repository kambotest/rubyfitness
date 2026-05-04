import { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import FoodTab from './components/FoodTab.jsx';
import MoveTab from './components/MoveTab.jsx';
import GoalsTab from './components/GoalsTab.jsx';
import Settings from './components/Settings.jsx';
import { load, save } from './utils/storage.js';
import { checkAndFire } from './utils/notifications.js';
import { registerCustomFoods } from './data/foods.js';
import { UndoProvider } from './components/UndoToast.jsx';

const TABS = [
  { id: 'home',  label: 'Home',  icon: HomeIcon },
  { id: 'food',  label: 'Food',  icon: FoodIcon },
  { id: 'move',  label: 'Move',  icon: MoveIcon },
  { id: 'goals', label: 'Goals', icon: GoalsIcon },
  { id: 'you',   label: 'You',   icon: SelfIcon },
];

export default function App() {
  const [state, setState] = useState(load);
  const [tab, setTab] = useState('home');

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
          {tab === 'home'  && <Home     state={state} setState={setState} />}
          {tab === 'food'  && <FoodTab  state={state} setState={setState} />}
          {tab === 'move'  && <MoveTab  state={state} setState={setState} />}
          {tab === 'goals' && <GoalsTab state={state} setState={setState} />}
          {tab === 'you'   && <Settings state={state} setState={setState} />}
        </main>

        <nav className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30
                        bg-white/95 backdrop-blur border border-stone rounded-full shadow-whisper
                        px-2 py-1.5 flex items-center gap-1 max-w-md sm:w-[28rem] mx-auto"
          style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full transition
                  ${active ? 'bg-caramel text-canvas' : 'text-cocoa hover:bg-blush/40'}`}>
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
function FoodIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11V5h2v6"/><path d="M9 11V5"/><path d="M5 11h6"/><path d="M14 5c2 0 5 2 5 7v9"/><path d="M9 11v10"/>
  </svg>);
}
function MoveIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13" cy="4" r="2"/><path d="M4 22l5-9 4 3 3-5 4 3"/>
  </svg>);
}
function GoalsIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>);
}
function SelfIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>
  </svg>);
}
