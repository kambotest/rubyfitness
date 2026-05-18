// In-page Notification API integration. Fires OS-level notifications from
// the Web Notifications API while the page or installed PWA is running.
// No backend / VAPID push, so notifications land only when the app has
// been opened recently — that's the documented honest constraint.
//
// Triggers (each gated by state.notifications.triggers and quiet-hours):
//   streakAtRisk  — after 8 PM if the user has a goal streak going and
//                   today's checklist isn't yet complete.
//   mealCadence   — after 11 AM if no food has been logged today.
//   hydrationLow  — after 2 PM if hydration < 50% of target.
//
// Each trigger fires at most once per (goalId × calendar day), tracked
// in-memory; reload resets the in-memory dedupe but the conditions
// usually self-resolve before the next opportunity to fire.

let firedKeys = new Set();
const QUIET_DEFAULT_START = 21; // 9 PM
const QUIET_DEFAULT_END   = 7;  // 7 AM

export function isPermissionGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const r = await Notification.requestPermission();
    return r;
  } catch {
    return 'denied';
  }
}

function inQuietHours(cfg) {
  const now = new Date();
  const h = now.getHours();
  const start = parseHour(cfg?.quietStart) ?? QUIET_DEFAULT_START;
  const end   = parseHour(cfg?.quietEnd)   ?? QUIET_DEFAULT_END;
  // Window can wrap midnight (e.g. 21:00 to 07:00).
  if (start === end) return false;
  if (start < end)   return h >= start && h < end;
  return h >= start || h < end;
}

function parseHour(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function fire(key, title, body) {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  try {
    new Notification(title, { body, icon: '/icon.svg', tag: key });
  } catch {
    // Older browsers may need ServiceWorkerRegistration.showNotification.
    // We deliberately don't depend on a service worker here.
  }
}

// Called periodically from App.jsx. No-op when permission isn't granted
// or notifications are globally disabled in user settings.
export function checkAndFire(state) {
  if (!isPermissionGranted()) return;
  const cfg = state.notifications || {};
  if (!cfg.enabled) return;
  if (inQuietHours(cfg)) return;

  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const triggers = cfg.triggers || {};

  // streakAtRisk
  if (triggers.streakAtRisk && hour >= 20) {
    const goals = state.dailyGoals || [];
    const checks = state.dailyChecks?.[today] || {};
    const todayDone = goals.length > 0 && goals.every((g) => checks[g.id]);
    if (!todayDone) {
      const streak = priorStreak(state.dailyChecks || {}, goals, today);
      if (streak > 0) {
        const left = goals.filter((g) => !checks[g.id]).length;
        fire(
          `streak:${today}`,
          'Streak at risk',
          `${streak}-day streak. ${left} goal${left === 1 ? '' : 's'} left for today.`,
        );
      }
    }
  }

  // mealCadence
  if (triggers.mealCadence && hour >= 11) {
    const todayEntries = (state.foodEntries || []).filter((e) => e.date === today && !e.needsMacros);
    if (todayEntries.length === 0) {
      fire(`meals:${today}`, 'No food logged yet', 'Open the brand search and add breakfast.');
    }
  }

  // hydrationLow
  if (triggers.hydrationLow && hour >= 14) {
    const target = state.goals?.hydrationMl || 2500;
    const cur = state.hydration?.[today]?.ml || 0;
    if (cur < target * 0.5) {
      fire(`hydration:${today}`, 'Hydration low', `${cur} mL of ${target} mL target. Top up.`);
    }
  }
}

// Days of consecutive completed goals BEFORE today. Used to surface
// "your streak is at risk" rather than "your streak is N days long".
function priorStreak(checks, goals, today) {
  if (!goals.length) return 0;
  let streak = 0;
  const cursor = new Date(today + 'T00:00');
  for (let i = 1; i <= 365; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (!goals.every((g) => (checks[iso] || {})[g.id])) break;
    streak += 1;
  }
  return streak;
}
