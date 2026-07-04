// Period/date-range helpers for the Data tab's Day / Week / Month reports.
// All dates are local 'YYYY-MM-DD' strings (see src/utils/dates.js) so string
// comparison is chronological and matches how nc_diary/nc_water key rows.
import { toDateStr, todayStr, parseDate, prevDay } from '../utils/dates';

// Monday of the week containing `s`, as 'YYYY-MM-DD'.
export function weekStart(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mon=0 … Sun=6
  return toDateStr(d);
}

// Inclusive { start, end } range for the period containing `anchor`.
export function getPeriodRange(period, anchor) {
  if (period === 'week') {
    const start = weekStart(anchor);
    const d = parseDate(start);
    d.setDate(d.getDate() + 6);
    return { start, end: toDateStr(d) };
  }
  if (period === 'month') {
    const d = parseDate(anchor);
    const start = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { start, end };
  }
  return { start: anchor, end: anchor };
}

// New anchor after stepping one period back (dir = -1) or forward (dir = +1).
export function shiftPeriod(period, anchor, dir) {
  const d = parseDate(anchor);
  if (period === 'week') {
    const w = parseDate(weekStart(anchor));
    w.setDate(w.getDate() + dir * 7);
    return toDateStr(w);
  }
  if (period === 'month') {
    return toDateStr(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }
  d.setDate(d.getDate() + dir);
  return toDateStr(d);
}

// True when `anchor` falls in the period containing today (forward nav disabled).
export function isCurrentPeriod(period, anchor) {
  const t = todayStr();
  if (period === 'week') return weekStart(anchor) === weekStart(t);
  if (period === 'month') return anchor.slice(0, 7) === t.slice(0, 7);
  return anchor >= t;
}

const fmtMD = s => parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// { label, sub } for the date-nav header.
export function periodLabel(period, anchor) {
  const t = todayStr();
  if (period === 'day') {
    const label = anchor === t ? 'Today'
      : anchor === prevDay(t) ? 'Yesterday'
      : parseDate(anchor).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const sub = parseDate(anchor).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return { label, sub };
  }
  if (period === 'week') {
    const { start, end } = getPeriodRange('week', anchor);
    const range = `${fmtMD(start)} – ${fmtMD(end)}`;
    if (isCurrentPeriod('week', anchor)) return { label: 'This Week', sub: range };
    return { label: range, sub: `${parseDate(end).getFullYear()}` };
  }
  const name = parseDate(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (isCurrentPeriod('month', anchor)) return { label: 'This Month', sub: name };
  const { start, end } = getPeriodRange('month', anchor);
  return { label: name, sub: `${fmtMD(start)} – ${fmtMD(end)}` };
}

// Inclusive day count between two 'YYYY-MM-DD' strings.
export function countDays(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1;
}

// Days of the period that have already happened (for averaging expenditure);
// never less than 1, never more than the full period length.
export function elapsedDays(start, end) {
  const t = todayStr();
  const stop = end < t ? end : t;
  return Math.max(1, Math.min(countDays(start, end), countDays(start, stop)));
}

// Divide every numeric field of a computeTotals() result (per-day averages).
export function scaleTotals(totals, factor) {
  const out = {};
  for (const [k, v] of Object.entries(totals)) {
    out[k] = typeof v === 'number' ? v * factor : v;
  }
  return out;
}
