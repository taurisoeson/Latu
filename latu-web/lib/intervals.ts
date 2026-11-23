// Minimal intervals.icu API client (read + calendar events). Auth: API key from the athlete's Developer Settings.
const BASE = process.env.INTERVALS_BASE_URL || 'https://intervals.icu/api/v1';

export function athleteId() {
  return process.env.INTERVALS_ATHLETE_ID || '0';
}

export async function icu(path: string, init: RequestInit = {}) {
  const key = process.env.INTERVALS_API_KEY;
  if (!key) throw new Error('INTERVALS_API_KEY puudub Verceli seadetes.');
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      authorization: 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64'),
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await r.text();
  if (!r.ok) throw new Error('intervals.icu ' + r.status + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

const pick = <T extends Record<string, unknown>>(o: T, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== null && o[k] !== '').map((k) => [k, o[k]]));

export const ACTIVITY_FIELDS = [
  'id', 'start_date_local', 'type', 'name', 'description', 'moving_time', 'elapsed_time', 'distance', 'total_elevation_gain',
  'average_heartrate', 'max_heartrate', 'average_speed', 'max_speed', 'average_cadence', 'icu_training_load', 'icu_intensity',
  'icu_hr_zone_times', 'icu_hr_zones', 'icu_rpe', 'feel', 'trimp', 'icu_efficiency_factor', 'decoupling', 'icu_atl', 'icu_ctl',
  'race', 'commute', 'device_name', 'calories', 'lthr', 'athlete_max_hr', 'interval_summary', 'workout_doc',
];

export function slimActivity(a: Record<string, unknown>) {
  return pick(a, ACTIVITY_FIELDS);
}

export const WELLNESS_FIELDS = [
  'id', 'ctl', 'atl', 'rampRate', 'ctlLoad', 'atlLoad', 'weight', 'restingHR', 'hrv', 'hrvSDNN', 'readiness', 'sleepSecs',
  'sleepScore', 'sleepQuality', 'avgSleepingHR', 'soreness', 'fatigue', 'stress', 'mood', 'motivation', 'injury', 'spO2',
  'kcalConsumed', 'steps', 'vo2max', 'comments', 'menstrualPhase',
];

export function slimWellness(w: Record<string, unknown>) {
  return pick(w, WELLNESS_FIELDS);
}

// Evenly downsample parallel stream arrays to at most n points.
export function downsample(streams: { type: string; data: unknown[] }[], n: number) {
  const len = Math.max(0, ...streams.map((s) => (Array.isArray(s.data) ? s.data.length : 0)));
  if (len <= n) return { points: len, streams: Object.fromEntries(streams.map((s) => [s.type, s.data])) };
  const step = len / n;
  const idx = Array.from({ length: n }, (_, i) => Math.floor(i * step));
  return {
    points: n, originalPoints: len, note: 'Iga ' + step.toFixed(1) + '. punkt (keskmistamata).',
    streams: Object.fromEntries(streams.map((s) => [s.type, Array.isArray(s.data) ? idx.map((i) => s.data[i]) : s.data])),
  };
}
