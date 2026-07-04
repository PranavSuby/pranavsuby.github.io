// Pure constants + data-aggregation helpers for the History tab.
// No React here — everything is testable in isolation.
import { fmtVolume } from '../../utils/format';
import { calcVolume } from '../../utils/stats';
import { getExerciseByName } from '../../utils/exercises';

// ── Constants ──────────────────────────────────────────────────────────────────
export const DAY_ABBR    = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTH_NAMES = MONTHS_FULL;
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const PERIOD_OPTS = [
  { id: '1w',  label: '1W' },
  { id: '3m',  label: '3M' },
  { id: '1y',  label: '1Y' },
  { id: 'all', label: 'All' },
];
export const METRIC_OPTS = [
  { id: 'duration', label: 'Duration' },
  { id: 'volume',   label: 'Volume' },
  { id: 'reps',     label: 'Reps' },
];
export const LINE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a78bfa','#06b6d4','#f43f5e','#84cc16'];

export const RADAR_GROUPS = [
  { label: 'Back',      keys: ['lats', 'lower back', 'middle back', 'back'] },
  { label: 'Chest',     keys: ['chest'] },
  { label: 'Core',      keys: ['abdominals', 'waist'] },
  { label: 'Arms',      keys: ['biceps', 'triceps', 'forearms', 'upper arms', 'lower arms'] },
  { label: 'Shoulders', keys: ['shoulders', 'traps', 'neck'] },
  { label: 'Legs',      keys: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'upper legs', 'lower legs'] },
];

export const MUSCLE_LIST = [
  { label: 'Abdominals', key: 'abdominals' },
  { label: 'Abductors',  key: 'abductors' },
  { label: 'Adductors',  key: 'adductors' },
  { label: 'Biceps',     key: 'biceps' },
  { label: 'Calves',     key: 'calves' },
  { label: 'Chest',      key: 'chest' },
  { label: 'Forearms',   key: 'forearms' },
  { label: 'Glutes',     key: 'glutes' },
  { label: 'Hamstrings', key: 'hamstrings' },
  { label: 'Lats',       key: 'lats' },
  { label: 'Lower Back', key: 'lower back' },
  { label: 'Middle Back',key: 'middle back' },
  { label: 'Neck',       key: 'neck' },
  { label: 'Quadriceps', key: 'quadriceps' },
  { label: 'Shoulders',  key: 'shoulders' },
  { label: 'Traps',      key: 'traps' },
  { label: 'Triceps',    key: 'triceps' },
];

// ── Volume formatting ──────────────────────────────────────────────────────────
// Volume is stored as kg; render it in the user's chosen unit.
export function fmtVol(kg, units) {
  if (!kg || kg === 0) return '—';
  return fmtVolume(kg, units);
}

// ── Helper functions ───────────────────────────────────────────────────────────
export function getPeriodCutoff(period) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (period === '1w') { d.setDate(d.getDate() - 6); return d; }
  if (period === '3m') { d.setMonth(d.getMonth() - 3); return d; }
  if (period === '1y') { d.setFullYear(d.getFullYear() - 1); return d; }
  return null;
}

export function aggregateBarData(sessions, period) {
  const cutoff = getPeriodCutoff(period);
  const filtered = cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;

  // 1-week view → one bar per day. Pre-seed all 7 days so the whole week always shows,
  // with weekday names (Sun…Sat) on the x-axis.
  if (period === '1w') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = new Map();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      buckets.set(key, { key, label: DAY_LABELS[d.getDay()], duration: 0, volume: 0, reps: 0 });
    }
    for (const s of filtered) {
      const b = buckets.get(new Date(s.date).toLocaleDateString('en-CA'));
      if (!b) continue;
      b.duration += (s.duration || 0);
      b.volume += calcVolume(s.exercises || []);
      for (const ex of s.exercises || []) for (const set of ex.sets || []) if (set.completed) b.reps += (set.reps || 0);
    }
    return Array.from(buckets.values());
  }

  if (!filtered.length) return [];

  const useWeeks = period === '3m';   // 3M → weekly bars; 1Y / All → monthly bars
  const buckets = new Map();
  for (const s of filtered) {
    const d = new Date(s.date);
    let key, label;
    if (useWeeks) {
      const sun = new Date(d); sun.setDate(d.getDate() - d.getDay()); sun.setHours(0, 0, 0, 0);
      key = sun.toLocaleDateString('en-CA');
      label = `${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = MONTHS_SHORT[d.getMonth()];   // month name only (reads as a month, not a date)
    }
    if (!buckets.has(key)) buckets.set(key, { label, key, duration: 0, volume: 0, reps: 0 });
    const b = buckets.get(key);
    b.duration += (s.duration || 0);
    b.volume += calcVolume(s.exercises || []);
    for (const ex of s.exercises || []) {
      for (const set of ex.sets || []) {
        if (set.completed) b.reps += (set.reps || 0);
      }
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function getPeriodSummary(sessions, period) {
  const cutoff = getPeriodCutoff(period);
  const filtered = cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  const totalMin = filtered.reduce((a, s) => a + (s.duration || 0), 0);
  return { count: filtered.length, totalMin };
}

export function getBodyPartSets(sessions, cutoff) {
  const filtered = cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  const counts = {};
  for (const s of filtered) {
    for (const ex of s.exercises || []) {
      const bp = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
      if (bp) {
        const n = (ex.sets || []).filter(set => set.completed).length;
        counts[bp] = (counts[bp] || 0) + n;
      }
    }
  }
  return counts;
}

export function aggregateSetCountData(sessions, period) {
  const cutoff = getPeriodCutoff(period);
  const filtered = cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  const useDays  = period === '1w';
  const useWeeks = !useDays && period !== '1y' && period !== 'all';

  const buckets = new Map();
  const allMuscles = new Set();
  for (const s of filtered) {
    const d = new Date(s.date);
    let key, label;
    if (useDays) {
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      key = day.toLocaleDateString('en-CA');
      label = DAY_LABELS[day.getDay()];
    } else if (useWeeks) {
      const sun = new Date(d); sun.setDate(d.getDate() - d.getDay()); sun.setHours(0, 0, 0, 0);
      key = sun.toLocaleDateString('en-CA');
      label = `${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = MONTHS_SHORT[d.getMonth()];
    }
    if (!buckets.has(key)) buckets.set(key, { label, key });
    const b = buckets.get(key);
    for (const ex of s.exercises || []) {
      const bp = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
      if (!bp) continue;
      const n = (ex.sets || []).filter(set => set.completed).length;
      b[bp] = (b[bp] || 0) + n;
      allMuscles.add(bp);
    }
  }
  const data = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  return { lines: Array.from(allMuscles), data };
}

export function getRadarData(sessions, period) {
  const cutoff = getPeriodCutoff(period || '3m');
  const now = new Date();
  const periodLen = cutoff ? (now - cutoff) : null;
  const prevCutoff = periodLen ? new Date(cutoff - periodLen) : null;

  function groupSets(sess) {
    const bp = {};
    for (const s of sess) {
      for (const ex of s.exercises || []) {
        const p = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
        const n = (ex.sets || []).filter(set => set.completed).length;
        bp[p] = (bp[p] || 0) + n;
      }
    }
    return bp;
  }

  const currSess = cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  const prevSess = (cutoff && prevCutoff)
    ? sessions.filter(s => { const d = new Date(s.date); return d >= prevCutoff && d < cutoff; })
    : [];

  const currBP = groupSets(currSess);
  const prevBP = groupSets(prevSess);

  const maxVal = Math.max(1,
    ...RADAR_GROUPS.map(g => Math.max(
      g.keys.reduce((a, k) => a + (currBP[k] || 0), 0),
      g.keys.reduce((a, k) => a + (prevBP[k] || 0), 0),
    ))
  );

  return RADAR_GROUPS.map(g => ({
    group: g.label,
    current:  g.keys.reduce((a, k) => a + (currBP[k] || 0), 0) / maxVal * 100,
    previous: g.keys.reduce((a, k) => a + (prevBP[k] || 0), 0) / maxVal * 100,
  }));
}

// ── Week helpers ───────────────────────────────────────────────────────────────
export function weekStartFor(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sun = new Date(today);
  sun.setDate(today.getDate() - today.getDay() + offset * 7);
  return sun;
}

export function formatWeekRange(start, end) {
  const s = String(start.getDate()).padStart(2, '0');
  const e = String(end.getDate()).padStart(2, '0');
  if (start.getMonth() === end.getMonth()) {
    return `${s}-${e} ${MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sm = MONTHS_FULL[start.getMonth()].slice(0, 3);
  const em = MONTHS_FULL[end.getMonth()].slice(0, 3);
  return `${s} ${sm} – ${e} ${em} ${end.getFullYear()}`;
}
