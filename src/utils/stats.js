// Epley formula for estimated 1RM
export function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Total completed volume, normalized to kg. Each exercise's weight is in its own unit
// (kg or lbs), so we convert per exercise — otherwise lbs weights would be summed as if
// they were kg and then re-converted for display (double-counting ~2.2×). fmtVolume()
// takes kg and renders it in the user's chosen unit.
const LB_TO_KG = 1 / 2.20462;
export function calcVolume(exercises) {
  let kg = 0;
  for (const ex of exercises) {
    const factor = ex.units === 'lbs' ? LB_TO_KG : 1;
    for (const s of (ex.sets || [])) {
      if (s.completed && +s.weight > 0 && +s.reps > 0) kg += +s.weight * +s.reps * factor;
    }
  }
  return kg;
}

// The display unit for an exercise — the unit it was most recently logged in (its set
// weights are stored in that unit). Falls back to kg when never logged.
export function exerciseUnit(sessions, name) {
  let unit = 'kg', latest = -Infinity;
  for (const s of sessions || []) {
    const e = (s.exercises || []).find(x => x.name === name);
    if (e?.units) { const t = new Date(s.date).getTime(); if (t >= latest) { latest = t; unit = e.units; } }
  }
  return unit;
}

export function calcSets(exercises) {
  return exercises?.reduce((a, ex) => a + (ex.sets?.filter(s => s.completed).length || 0), 0) || 0;
}

// Per-exercise PRs from a list of sessions
// Returns { bestWeight, best1RM, bestVolume, maxReps, setRecords: {reps: weight} }
export function getExercisePRs(sessions, exerciseName) {
  let bestWeight = 0, best1RM = 0, bestVolume = 0, maxReps = 0;
  const setRecords = {}; // reps → { weight, date }

  for (const s of sessions) {
    const ex = s.exercises?.find(e => e.name === exerciseName);
    if (!ex) continue;
    const done = ex.sets?.filter(s => s.completed) || [];
    let sessVol = 0;
    for (const set of done) {
      const w = +set.weight || 0, r = +set.reps || 0;
      if (w > bestWeight) bestWeight = w;
      if (r > maxReps) maxReps = r;
      const rm = calc1RM(w, r);
      if (rm > best1RM) best1RM = rm;
      if (w > 0 && r > 0) {
        sessVol += w * r;
        if (!setRecords[r] || w > setRecords[r].weight) {
          setRecords[r] = { weight: w, date: s.date };
        }
      }
    }
    if (sessVol > bestVolume) bestVolume = sessVol;
  }

  return { bestWeight, best1RM, bestVolume, maxReps, setRecords };
}

// Build chart data points for a given metric
export function buildChartData(sessions, exerciseName, metric) {
  const points = [];
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const s of sorted) {
    const ex = s.exercises?.find(e => e.name === exerciseName);
    if (!ex) continue;
    const done = ex.sets?.filter(s => s.completed) || [];
    let val = null;
    switch (metric) {
      case 'weight': {
        const ws = done.filter(s => +s.weight > 0).map(s => +s.weight);
        if (ws.length) val = Math.max(...ws);
        break;
      }
      case '1rm': {
        const rs = done.filter(s => +s.weight > 0 && +s.reps > 0).map(s => calc1RM(+s.weight, +s.reps));
        if (rs.length) val = Math.max(...rs);
        break;
      }
      case 'volume': {
        const v = done.filter(s => +s.weight > 0 && +s.reps > 0).reduce((a, s) => a + +s.weight * +s.reps, 0);
        if (v > 0) val = v;
        break;
      }
      case 'reps': {
        const rs = done.filter(s => +s.reps > 0).map(s => +s.reps);
        if (rs.length) val = rs.reduce((a, b) => a + b, 0);
        break;
      }
      case 'duration': {
        const ts = done.filter(s => +s.time > 0).map(s => +s.time);
        if (ts.length) val = Math.max(...ts);
        break;
      }
      default: break;
    }
    if (val !== null) points.push({ date: s.date.slice(0, 10), value: val });
  }

  // Mark PRs
  let runMax = -Infinity;
  return points.map(p => {
    const isPR = p.value > runMax && points.length > 1;
    if (p.value > runMax) runMax = p.value;
    return { ...p, isPR };
  });
}
