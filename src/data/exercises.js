// Exercise database. MET values from Compendium of Physical Activities.
// kcal = MET * weightKg * hours.
// `intensity` describes a default; many activities also accept "easy"/"moderate"/"hard" multipliers.

export const EXERCISES = [
  // POSTPARTUM-SAFE BASELINE
  { id:'walk_pram',     name:'Walking with pram',         aliases:['pram walk','stroller walk','walk with baby','walking with baby'], met:3.8, intensity:'moderate', tags:['postpartum','outdoors'] },
  { id:'walk_easy',     name:'Walking (easy)',            aliases:['walking','walk','stroll'],            met:3.0, intensity:'easy',     tags:['outdoors'] },
  { id:'walk_brisk',    name:'Walking (brisk)',           aliases:['brisk walk','power walk'],            met:4.3, intensity:'moderate', tags:['outdoors'] },
  { id:'walk_uphill',   name:'Walking uphill',            aliases:['hill walk','hike walk'],              met:6.0, intensity:'moderate', tags:['outdoors'] },
  { id:'hike',          name:'Hiking',                    aliases:['hike','bushwalk','trail'],            met:6.0, intensity:'moderate', tags:['outdoors'] },

  // RUNNING (key for the user's 30km goal)
  { id:'jog_easy',      name:'Jogging (easy, ~6min/km)',  aliases:['jog','jogging','easy run'],           met:7.0, intensity:'moderate', tags:['running'] },
  { id:'run_steady',    name:'Running (steady, ~5:30/km)',aliases:['run','running','steady run'],         met:8.3, intensity:'moderate', tags:['running'] },
  { id:'run_tempo',     name:'Running (tempo, ~5:00/km)', aliases:['tempo run'],                          met:9.8, intensity:'hard',     tags:['running'] },
  { id:'run_fast',      name:'Running (fast, ~4:30/km)',  aliases:['fast run','interval run'],            met:11.5,intensity:'hard',     tags:['running'] },
  { id:'run_intervals', name:'Run intervals (track)',     aliases:['intervals','track session'],          met:10.0,intensity:'hard',     tags:['running'] },
  { id:'parkrun',       name:'Parkrun (5km)',             aliases:['parkrun'],                            met:8.5, intensity:'moderate', tags:['running','event'] },

  // CYCLING
  { id:'cycle_leisure', name:'Cycling (leisurely)',       aliases:['cycle','bike ride','riding'],         met:4.0, intensity:'easy',     tags:['cardio'] },
  { id:'cycle_moderate',name:'Cycling (moderate)',        aliases:['cycling moderate'],                   met:6.8, intensity:'moderate', tags:['cardio'] },
  { id:'cycle_vigorous',name:'Cycling (vigorous)',        aliases:['cycling fast'],                       met:10.0,intensity:'hard',     tags:['cardio'] },
  { id:'spin_class',    name:'Spin / indoor cycling',     aliases:['spin','spin class'],                  met:8.5, intensity:'hard',     tags:['cardio','class'] },

  // SWIMMING
  { id:'swim_easy',     name:'Swimming (easy laps)',      aliases:['swim','swimming'],                    met:5.8, intensity:'moderate', tags:['cardio','low-impact'] },
  { id:'swim_hard',     name:'Swimming (vigorous)',       aliases:['swim hard'],                          met:9.8, intensity:'hard',     tags:['cardio','low-impact'] },
  { id:'aqua',          name:'Aqua aerobics',             aliases:['aqua','aqua aerobics'],               met:5.3, intensity:'moderate', tags:['low-impact'] },

  // STRENGTH
  { id:'strength_light',name:'Strength training (light)', aliases:['weights light','dumbbells'],          met:3.5, intensity:'easy',     tags:['strength'] },
  { id:'strength_mod',  name:'Strength training (moderate)', aliases:['weights','strength','gym'],       met:5.0, intensity:'moderate', tags:['strength'] },
  { id:'strength_hard', name:'Strength training (heavy)', aliases:['heavy lifting','heavy weights'],      met:6.0, intensity:'hard',     tags:['strength'] },
  { id:'bodyweight',    name:'Bodyweight circuit',        aliases:['bodyweight','calisthenics'],          met:5.0, intensity:'moderate', tags:['strength'] },

  // POSTNATAL & MIND-BODY
  { id:'postnatal_pilates', name:'Postnatal Pilates',     aliases:['pilates','postnatal pilates','reformer'], met:3.5, intensity:'easy', tags:['postpartum','mind-body'] },
  { id:'yoga_gentle',   name:'Yoga (gentle)',             aliases:['yoga','gentle yoga','restorative yoga'], met:2.5, intensity:'easy', tags:['mind-body'] },
  { id:'yoga_flow',     name:'Yoga (vinyasa flow)',       aliases:['vinyasa','flow yoga'],                met:4.0, intensity:'moderate', tags:['mind-body'] },
  { id:'pelvic_floor',  name:'Pelvic floor exercises',    aliases:['pelvic floor','kegels'],              met:2.0, intensity:'easy', tags:['postpartum'] },
  { id:'stretching',    name:'Stretching / mobility',     aliases:['stretching','mobility','foam roll'],  met:2.3, intensity:'easy', tags:['recovery'] },

  // CLASSES & MISC
  { id:'hiit',          name:'HIIT class',                aliases:['hiit','tabata'],                      met:8.0, intensity:'hard',     tags:['cardio','class'] },
  { id:'boxing',        name:'Boxing / kickboxing',       aliases:['boxing','kickboxing'],                met:7.8, intensity:'hard',     tags:['cardio'] },
  { id:'dance',         name:'Dance fitness',             aliases:['dance','zumba','dance class'],        met:6.0, intensity:'moderate', tags:['cardio','class'] },
  { id:'rowing',        name:'Rowing machine',            aliases:['rowing','erg'],                       met:7.0, intensity:'moderate', tags:['cardio'] },
  { id:'elliptical',    name:'Elliptical / cross-trainer',aliases:['elliptical','cross trainer'],         met:5.0, intensity:'moderate', tags:['cardio'] },
  { id:'pram_jog',      name:'Jogging with pram',         aliases:['running with pram','run with baby','jog with pram'], met:6.5, intensity:'moderate', tags:['postpartum','running'] },
  { id:'babywearing_walk', name:'Walking while babywearing', aliases:['babywearing','carrying baby walk'], met:4.5, intensity:'moderate', tags:['postpartum'] },
  { id:'mum_baby_class',name:'Mum & bub fitness class',   aliases:['mum and bub','mums and bubs'],        met:5.0, intensity:'moderate', tags:['postpartum','class'] },

  // EVERYDAY (still counts)
  { id:'housework',     name:'Housework',                 aliases:['cleaning','housework','vacuuming'],   met:3.3, intensity:'easy', tags:['daily'] },
  { id:'gardening',     name:'Gardening',                 aliases:['gardening','yard work'],              met:4.0, intensity:'moderate', tags:['daily'] },
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
const INDEX = EXERCISES.map((e) => ({ ex: e, keys: [e.name, ...(e.aliases||[])].map(norm) }));

export function findExercise(query) {
  const q = norm(query);
  if (!q) return null;
  for (const { ex, keys } of INDEX) if (keys.includes(q)) return ex;
  for (const { ex, keys } of INDEX) if (keys.some((k) => k.startsWith(q))) return ex;
  const words = q.split(/\s+/).filter(Boolean);
  let best=null, score=0;
  for (const { ex, keys } of INDEX) {
    for (const k of keys) {
      const hits = words.filter((w) => k.includes(w)).length;
      const s = hits / words.length;
      if (hits === words.length && s > score) { best = ex; score = s; }
    }
  }
  return best;
}

export function searchExercises(query, limit = 8) {
  const q = norm(query);
  if (!q) return EXERCISES.slice(0, limit);
  const out = [];
  for (const { ex, keys } of INDEX) {
    let s = 0;
    for (const k of keys) {
      if (k === q) s = Math.max(s, 100);
      else if (k.startsWith(q)) s = Math.max(s, 80);
      else if (k.includes(q)) s = Math.max(s, 50);
    }
    if (s > 0) out.push({ ex, s });
  }
  return out.sort((a,b) => b.s - a.s).slice(0, limit).map((x) => x.ex);
}

// kcal burned for an exercise.
export function kcalBurned(exercise, minutes, weightKg) {
  if (!exercise || !minutes || !weightKg) return 0;
  return Math.round(exercise.met * weightKg * (minutes / 60));
}

// rough distance estimation for running/cycling/walking based on minutes
export function estimateDistanceKm(exercise, minutes) {
  if (!exercise || !minutes) return 0;
  const paceMap = {
    walk_easy: 5, walk_brisk: 6, walk_pram: 4.5, walk_uphill: 4, hike: 4,
    babywearing_walk: 4, jog_easy: 9.5, run_steady: 11, run_tempo: 12,
    run_fast: 13.5, run_intervals: 12, pram_jog: 8, parkrun: 11,
    cycle_leisure: 18, cycle_moderate: 22, cycle_vigorous: 28, spin_class: 0,
    rowing: 0, elliptical: 0,
  };
  const kmh = paceMap[exercise.id] ?? 0;
  return Math.round(kmh * (minutes / 60) * 10) / 10;
}
