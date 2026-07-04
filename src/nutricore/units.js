// Height
export function cmToFtIn(cm) {
  const totalIn = Math.round((cm || 0) / 2.54);
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
}
export function ftInToCm(ft, inches) {
  return Math.round(((ft || 0) * 12 + (inches || 0)) * 2.54);
}

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / 2.20462;

// Weight
export function kgToDisplay(kg, unit) {
  const v = kg || 0;
  return unit === 'lbs' ? +(v * KG_TO_LBS).toFixed(1) : +v.toFixed(1);
}
export function displayToKg(val, unit) {
  return unit === 'lbs' ? +((val || 0) * LBS_TO_KG).toFixed(3) : +(val || 0);
}
export function weightUnit(unit) { return unit === 'lbs' ? 'lbs' : 'kg'; }

// Weight rate (per week)
export function kgRateToDisplay(kgPerWeek, unit) {
  const v = kgPerWeek || 0;
  return unit === 'lbs' ? +(v * KG_TO_LBS).toFixed(2) : +v.toFixed(2);
}
export function displayRateToKg(val, unit) {
  return unit === 'lbs' ? +((val || 0) * LBS_TO_KG).toFixed(3) : +(val || 0);
}
export function rateUnit(unit) { return unit === 'lbs' ? 'lbs/wk' : 'kg/wk'; }

// Water — one "cup"/glass is a standard US cup = 8 fl oz (~237 ml).
const ML_PER_FLOZ = 29.5735;
const ML_PER_CUP = 8 * ML_PER_FLOZ;

export function mlToDisplayVal(ml, unit) {
  const v = ml || 0;
  if (unit === 'ml')   return Math.round(v);
  if (unit === 'floz') return Math.round(v / ML_PER_FLOZ);
  return Math.floor(v / ML_PER_CUP); // cups
}
export function waterDisplayToMl(val, unit) {
  const v = val || 0;
  if (unit === 'floz') return Math.round(v * ML_PER_FLOZ);
  if (unit === 'cups') return Math.round(v * ML_PER_CUP);
  return Math.round(v);
}
export function waterGoalDisplay(unit) {
  if (unit === 'ml')   return { value: Math.round(8 * ML_PER_CUP), label: 'mL' };
  if (unit === 'floz') return { value: 64, label: 'fl oz' };
  return { value: 8, label: 'cups' };
}
export function waterUnitLabel(unit) {
  if (unit === 'ml')   return 'mL';
  if (unit === 'floz') return 'fl oz';
  return 'cups';
}

// Energy
export function kcalToDisplay(kcal, unit) {
  const v = Math.round(kcal || 0);
  if (unit === 'kj') return { value: Math.round(v * 4.184), label: 'kJ' };
  return { value: v, label: 'kcal' };
}
export function energyUnit(unit) { return unit === 'kj' ? 'kJ' : 'kcal'; }
