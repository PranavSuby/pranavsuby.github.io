// Plate math + warm-up ramp helpers (pure, unit-aware).

export const BAR_DEFAULTS = { kg: 20, lbs: 45 };
export const PLATES = {
  kg:  [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};
const SMALLEST = { kg: 1.25, lbs: 2.5 }; // smallest pair increment

// Plates needed on ONE side of the bar to reach `target`.
// Returns { perSide: [{ weight, count }], loadable, leftover }.
export function computePlates(target, bar, unit = 'kg') {
  const plates = PLATES[unit];
  const perSideWeight = (target - bar) / 2;
  if (!(perSideWeight > 0)) {
    return { perSide: [], loadable: target <= bar, leftover: Math.max(0, target - bar) };
  }
  let remaining = perSideWeight;
  const perSide = [];
  for (const p of plates) {
    let count = 0;
    while (remaining >= p - 1e-9) { remaining -= p; count++; }
    if (count) perSide.push({ weight: p, count });
  }
  const leftover = Math.round(remaining * 100) / 100;
  return { perSide, loadable: leftover < 1e-6, leftover };
}

// Round to the nearest loadable total (multiples of the smallest plate pair).
export function roundToLoadable(weight, bar, unit = 'kg') {
  const step = SMALLEST[unit] * 2; // a pair changes the total by 2× the plate
  const above = Math.max(bar, Math.round((weight - bar) / step) * step + bar);
  return Math.round(above * 100) / 100;
}

// Warm-up ramp toward a working weight. Percent/reps scheme is intentionally simple.
const DEFAULT_SCHEME = [
  { pct: 0.4,  reps: 8 },
  { pct: 0.55, reps: 5 },
  { pct: 0.7,  reps: 3 },
  { pct: 0.85, reps: 2 },
];
export function warmupSets(workWeight, bar = BAR_DEFAULTS.kg, unit = 'kg') {
  if (!(workWeight > bar)) return [];
  return DEFAULT_SCHEME
    .map(s => ({ weight: roundToLoadable(workWeight * s.pct, bar, unit), reps: s.reps, pct: Math.round(s.pct * 100) }))
    .filter(s => s.weight >= bar);
}
