// Body metrics live in NutriCore's nc_biometrics store so weight & measurements are
// shared across both apps (log in the gym, see the trend in NutriCore and vice-versa).
import {
  addBiometric, getBiometricsInRange,
  initNutriCore, getProfile,
} from '../nutricore/db';
import { todayStr, daysAgoStr } from './dates';

// type → display metadata. Values are stored in metric units (kg / cm / %).
export const METRICS = [
  { type: 'weight_kg',   label: 'Weight',   unit: 'kg', kind: 'weight' },
  { type: 'bodyfat_pct', label: 'Body Fat', unit: '%',  kind: 'pct' },
  { type: 'waist_cm',    label: 'Waist',    unit: 'cm', kind: 'len' },
  { type: 'chest_cm',    label: 'Chest',    unit: 'cm', kind: 'len' },
  { type: 'arms_cm',     label: 'Arms',     unit: 'cm', kind: 'len' },
  { type: 'thighs_cm',   label: 'Thighs',   unit: 'cm', kind: 'len' },
  { type: 'hips_cm',     label: 'Hips',     unit: 'cm', kind: 'len' },
];

export async function logMetric(type, value, date) {
  await initNutriCore();
  return addBiometric(date || todayStr(), type, value);
}

// Ascending by date: [{ date, value, ... }]
export async function getMetricHistory(type, days = 3650) {
  await initNutriCore();
  return getBiometricsInRange(type, daysAgoStr(days), todayStr());
}

export async function getLatestMetric(type) {
  const hist = await getMetricHistory(type);
  return hist.length ? hist[hist.length - 1] : null;
}

// Best available bodyweight in kg: latest logged measurement → profile → 75 default.
export async function getBodyWeightKg() {
  try {
    const latest = await getLatestMetric('weight_kg');
    if (latest?.value) return latest.value;
    const p = await getProfile();
    if (p?.weightKg) return p.weightKg;
  } catch {}
  return 75;
}

// Unit helpers for weight (stored kg, shown in the user's preferred unit).
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
