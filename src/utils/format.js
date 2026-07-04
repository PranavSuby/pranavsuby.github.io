export function fmtDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtWeight(val, units) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (units === 'lbs') return Math.round(n * 2.20462).toString();
  return n.toString();
}

export function fmtVolume(kg, units) {
  const val = units === 'lbs' ? kg * 2.20462 : kg;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k ${units}`;
  return `${Math.round(val)} ${units}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  // Include the year for past years so e.g. "Jan 5" of two different years
  // can't collapse into one History group.
  const opts = { weekday: 'long', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

export function fmtShortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTimeOfDay(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
