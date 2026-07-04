// Estimate calories burned in the gym so NutriCore can fold them into expenditure.
// Strength training ≈ 5 METs; kcal = MET × bodyweightKg × hours. Each finished session
// stores its own `estimatedKcal` (see WorkoutContext); we prefer that and only fall back
// to a live duration estimate for older sessions saved before this existed.
import { getAllSessions } from '../db';
import { toDateStr } from './dates';

export const STRENGTH_MET = 5;

export function estimateCalories(durationSec, weightKg = 75) {
  return Math.round(STRENGTH_MET * (weightKg || 75) * ((durationSec || 0) / 3600));
}

export async function getGymCaloriesForDate(dateStr, weightKg = 75) {
  const { kcal, minutes, workouts } = await getGymCaloriesForRange(dateStr, dateStr, weightKg);
  return { kcal, minutes, workouts };
}

// Totals over [startDate, endDate] (inclusive local 'YYYY-MM-DD' strings) in a
// single session scan, plus a per-day kcal map for aggregate reports.
export async function getGymCaloriesForRange(startDate, endDate, weightKg = 75) {
  try {
    const all = await getAllSessions();
    let kcal = 0;
    let minutes = 0;
    let workouts = 0;
    const byDate = {};
    for (const s of all) {
      if (!s.date) continue;
      const day = toDateStr(new Date(s.date));
      if (day < startDate || day > endDate) continue;
      const k = s.estimatedKcal != null ? s.estimatedKcal : estimateCalories(s.duration, weightKg);
      kcal += k;
      minutes += Math.round((s.duration || 0) / 60);
      workouts++;
      byDate[day] = (byDate[day] || 0) + k;
    }
    return { kcal: Math.round(kcal), minutes, workouts, byDate };
  } catch {
    return { kcal: 0, minutes: 0, workouts: 0, byDate: {} };
  }
}
