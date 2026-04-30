// Health-sync utilities. Two integrations:
//
// 1. Apple Health export import (works today, no setup).
//    On iPhone: Health app → profile (top-right) → Export All Health
//    Data → produces export.zip containing export.xml. Upload that XML
//    here; we parse <Workout> and <Record type="HKQuantityTypeIdentifierBodyMass">
//    elements and merge them into state.exerciseEntries / state.weights.
//    Steps and HR are intentionally not imported — they'd dwarf the
//    JSON blob and aren't shown anywhere yet.
//
// 2. Google Fit live sync (architecture only — needs the deployer to
//    register an OAuth Client ID at console.cloud.google.com, enable the
//    Fitness API, add the redirect URI, then paste the client ID into
//    Settings → Health sync). The browser-side token flow is
//    implemented; on auth, we pull sessions for the last N days and
//    convert them to exerciseEntries.
//
// 3. Apple Health LIVE (HealthKit) — explicitly out of scope for the
//    PWA: HealthKit has no web API, and would require wrapping the app
//    in a Capacitor / native iOS shell. The XML import covers the
//    common case (manual export every few weeks).

import { newId } from './storage.js';

// ---------- Apple Health XML import ----------

// Map HKWorkoutActivityType ids → our exercise.id where there's a clean
// equivalent in src/data/exercises.js. Anything else falls back to
// 'workout' with the raw type as a label.
const APPLE_ACTIVITY_MAP = {
  HKWorkoutActivityTypeRunning:        { id: 'run_steady',     name: 'Running' },
  HKWorkoutActivityTypeWalking:        { id: 'walk_brisk',     name: 'Walking' },
  HKWorkoutActivityTypeCycling:        { id: 'cycle_moderate', name: 'Cycling' },
  HKWorkoutActivityTypeYoga:           { id: 'yoga',           name: 'Yoga' },
  HKWorkoutActivityTypePilates:        { id: 'pilates',        name: 'Pilates' },
  HKWorkoutActivityTypeSwimming:       { id: 'swim',           name: 'Swimming' },
  HKWorkoutActivityTypeFunctionalStrengthTraining: { id: 'strength_moderate', name: 'Strength training' },
  HKWorkoutActivityTypeTraditionalStrengthTraining: { id: 'strength_moderate', name: 'Strength training' },
  HKWorkoutActivityTypeHighIntensityIntervalTraining: { id: 'hiit', name: 'HIIT' },
};

export async function parseAppleHealthExport(xmlText) {
  // Parse with DOMParser — works in browser, ~50 ms for a typical 5 MB
  // export. We deliberately don't pull the full text into a string array
  // before iterating; the parser handles the document tree directly.
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('Could not parse the export.xml file. Make sure you uploaded export.xml from the Apple Health zip, not the zip itself.');

  const workouts = [...doc.getElementsByTagName('Workout')].map((w) => {
    const type = w.getAttribute('workoutActivityType');
    const startDate = w.getAttribute('startDate');
    const duration = parseFloat(w.getAttribute('duration') || '0');
    const durationUnit = w.getAttribute('durationUnit') || 'min';
    const totalDistance = parseFloat(w.getAttribute('totalDistance') || '0');
    const distanceUnit = w.getAttribute('totalDistanceUnit') || 'km';
    const totalEnergyBurned = parseFloat(w.getAttribute('totalEnergyBurned') || '0');
    const energyUnit = w.getAttribute('totalEnergyBurnedUnit') || 'kcal';

    const map = APPLE_ACTIVITY_MAP[type] || { id: 'workout', name: type?.replace(/^HKWorkoutActivityType/, '') || 'Workout' };
    const minutes = durationUnit === 'h' ? duration * 60 : duration;
    const km = distanceUnit === 'mi' ? totalDistance * 1.609 : totalDistance;
    const kcal = energyUnit === 'kJ' ? totalEnergyBurned / 4.184 : totalEnergyBurned;
    const date = (startDate || '').slice(0, 10);

    return {
      id: newId(),
      date,
      exerciseId: map.id,
      name: map.name,
      minutes: Math.round(minutes),
      km: km > 0 ? Math.round(km * 10) / 10 : null,
      kcal: Math.round(kcal),
      raw: 'Apple Health',
      source: 'apple_health',
    };
  }).filter((x) => x.date && x.minutes > 0);

  const weights = [...doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierBodyMass"]')]
    .map((r) => {
      const date = (r.getAttribute('startDate') || '').slice(0, 10);
      const value = parseFloat(r.getAttribute('value') || '0');
      const unit = r.getAttribute('unit') || 'kg';
      const kg = unit === 'lb' ? value * 0.4536 : value;
      return { date, kg: Math.round(kg * 10) / 10 };
    })
    .filter((w) => w.date && w.kg > 0)
    // dedupe to one weight per day (keep latest)
    .reduce((acc, w) => { acc[w.date] = w; return acc; }, {});

  return {
    workouts,
    weights: Object.values(weights),
  };
}

// Merge parsed Apple Health data into state. De-dupes against existing
// entries by (date, source, minutes) for workouts and (date) for weights.
export function mergeAppleHealthIntoState(state, parsed) {
  const existingWorkoutKeys = new Set(
    (state.exerciseEntries || [])
      .filter((e) => e.source === 'apple_health')
      .map((e) => `${e.date}|${e.exerciseId}|${e.minutes}`)
  );
  const newWorkouts = parsed.workouts.filter((w) => !existingWorkoutKeys.has(`${w.date}|${w.exerciseId}|${w.minutes}`));

  const existingWeightDates = new Set((state.weights || []).map((w) => w.date));
  const newWeights = parsed.weights.filter((w) => !existingWeightDates.has(w.date));

  return {
    ...state,
    exerciseEntries: [...(state.exerciseEntries || []), ...newWorkouts],
    weights: [...(state.weights || []), ...newWeights],
    healthSync: {
      ...(state.healthSync || {}),
      appleHealthLastImportAt: new Date().toISOString(),
    },
    _imported: { workouts: newWorkouts.length, weights: newWeights.length },
  };
}

// ---------- Google Fit OAuth (browser-side, implicit flow) ----------
//
// To use: register at https://console.cloud.google.com:
//   - Create OAuth 2.0 Client ID (type: Web application)
//   - Authorized JS origins: your Vercel URL + http://localhost:5173
//   - Authorized redirect URIs: <same>/oauth/google
//   - Enable Fitness API
// Paste the client id into Settings → Health sync.
//
// We use the implicit token flow (response_type=token) so no server is
// required — the access token comes back in the URL fragment.

const GOOGLE_FIT_SCOPE = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
].join(' ');

export function googleFitAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: GOOGLE_FIT_SCOPE,
    include_granted_scopes: 'true',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function readGoogleFitTokenFromHash() {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash || '';
  if (!h.startsWith('#')) return null;
  const params = new URLSearchParams(h.slice(1));
  const t = params.get('access_token');
  const exp = parseInt(params.get('expires_in') || '0', 10);
  if (!t) return null;
  return { token: t, expiresAt: Date.now() + exp * 1000 };
}

export async function fetchGoogleFitSessions(token, days = 14) {
  const endTime = Date.now();
  const startTime = endTime - days * 86400 * 1000;
  const r = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Google Fit returned ${r.status}`);
  const data = await r.json();
  const sessions = (data.session || []).map((s) => {
    const startMs = parseInt(s.startTimeMillis || '0', 10);
    const endMs = parseInt(s.endTimeMillis || '0', 10);
    const minutes = Math.round((endMs - startMs) / 60000);
    return {
      id: newId(),
      date: new Date(startMs).toISOString().slice(0, 10),
      exerciseId: 'workout',
      name: s.name || s.activityType || 'Activity',
      minutes,
      kcal: 0,
      km: null,
      raw: 'Google Fit',
      source: 'google_fit',
    };
  }).filter((s) => s.minutes > 0);
  return sessions;
}
