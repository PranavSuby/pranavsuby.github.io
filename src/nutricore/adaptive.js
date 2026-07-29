// Adaptive energy expenditure (MacroFactor-style dynamic TDEE).
//
// Instead of trusting the Mifflin-St Jeor formula, back-calculate what the
// user's expenditure must actually have been from what they logged eating and
// how their smoothed weight changed over the same window:
//
//   observed TDEE ≈ avg logged intake − (Δ trend weight per day × 7700 kcal/kg)
//
// The result is blended with the formula TDEE by a confidence factor that grows
// with data quantity, so sparse data degrades gracefully to the formula instead
// of producing wild numbers. Everything here is pure math except
// getAdaptiveExpenditure(), which pulls its data window from IndexedDB.

import { getCalorieHistory, getBiometricsInRange } from './db';
import { computeTDEE } from './tdee';
import { toDateStr } from '../utils/dates';

export const KCAL_PER_KG = 7700;

const WINDOW_DAYS     = 28;   // look-back window for intake + weigh-ins
const MIN_LOGGED_DAYS = 7;    // intake days required before adaptive kicks in
const MIN_WEIGH_INS   = 3;
const MIN_WEIGH_SPAN  = 7;    // days between first and last weigh-in
const TREND_ALPHA     = 0.13; // per-day EMA smoothing factor

export function daysBetween(a, b) {
  return (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000;
}

// Monday of the week containing d — the key used to run coaching once per week.
export function weekKey(d = new Date()) {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(m);
}

// Exponentially smoothed trend weight. Input: [{ date: 'YYYY-MM-DD', weightKg }]
// chronological, one entry per day. Gap-aware: a gap of g days applies
// 1 − (1−α)^g so irregular weigh-in cadence doesn't under- or over-smooth.
export function computeTrendWeight(weighIns) {
  if (!weighIns.length) return [];
  const out = [];
  let trend = weighIns[0].weightKg;
  let prevDate = weighIns[0].date;
  for (const w of weighIns) {
    const gap = Math.max(1, daysBetween(prevDate, w.date));
    const k = 1 - Math.pow(1 - TREND_ALPHA, gap);
    trend += k * (w.weightKg - trend);
    out.push({ date: w.date, weightKg: w.weightKg, trendKg: +trend.toFixed(2) });
    prevDate = w.date;
  }
  return out;
}

// Pure calculation over a prepared window. calorieHistory: [{ date, kcal }]
// (0 = unlogged day, excluded from the average — a truly-fasted day therefore
// also drops out; acceptable, since we can't tell the two apart).
export function computeAdaptiveExpenditure({ calorieHistory, weighIns, formulaTdee }) {
  const logged = calorieHistory.filter(d => d.kcal > 0);
  const trend  = computeTrendWeight(weighIns);
  const spanDays = trend.length >= 2 ? daysBetween(trend[0].date, trend[trend.length - 1].date) : 0;

  const base = {
    available: false,
    tdee: Math.round(formulaTdee),
    formulaTdee: Math.round(formulaTdee),
    loggedDays: logged.length,
    weighInCount: trend.length,
    spanDays,
  };
  if (logged.length < MIN_LOGGED_DAYS || trend.length < MIN_WEIGH_INS || spanDays < MIN_WEIGH_SPAN) {
    return base;
  }

  const avgIntake   = logged.reduce((s, d) => s + d.kcal, 0) / logged.length;
  const slopePerDay = (trend[trend.length - 1].trendKg - trend[0].trendKg) / spanDays;
  // Clamp to a physiological band; the confidence blend below also pulls
  // outliers toward the formula.
  const observed = Math.min(6000, Math.max(1000, avgIntake - slopePerDay * KCAL_PER_KG));
  const confidence = Math.min(1, logged.length / 21) * Math.min(1, spanDays / 14);

  return {
    ...base,
    available: true,
    tdee: Math.round(confidence * observed + (1 - confidence) * formulaTdee),
    observed: Math.round(observed),
    confidence: +confidence.toFixed(2),
    trendKgWeek: +(slopePerDay * 7).toFixed(2),
  };
}

// Load the last WINDOW_DAYS of data and compute. Intake ends at *yesterday* so
// today's partially-logged diary doesn't drag the average down; weigh-ins may
// include today.
export async function getAdaptiveExpenditure(profile) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const start = new Date(today);     start.setDate(today.getDate() - WINDOW_DAYS);

  const [hist, weights] = await Promise.all([
    getCalorieHistory(toDateStr(start), toDateStr(yesterday)),
    getBiometricsInRange('weight_kg', toDateStr(start), toDateStr(today)),
  ]);

  // Dedupe weigh-ins per day — later same-day records win (insertion order).
  const byDay = new Map();
  for (const b of weights) byDay.set(b.date, b);
  const weighIns = [...byDay.values()]
    .map(b => ({ date: b.date, weightKg: b.value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return computeAdaptiveExpenditure({
    calorieHistory: hist,
    weighIns,
    formulaTdee: computeTDEE(profile).tdee,
  });
}
