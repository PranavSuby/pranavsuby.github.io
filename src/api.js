// api.js — ExerciseDB free API (no key required)
// Base: https://exercisedb.dev (open-source v1, 1300+ exercises with GIFs)

const BASE = 'https://exercisedb.dev/api/exercises';

export async function fetchExercisesByBodyPart(bodyPart, limit = 50) {
  const res = await fetch(`${BASE}/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function fetchExercisesByName(name) {
  const res = await fetch(`${BASE}?name=${encodeURIComponent(name)}&limit=30`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function fetchExerciseById(id) {
  const res = await fetch(`${BASE}/exercise/${id}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function fetchBodyPartList() {
  const res = await fetch(`${BASE}/bodyPartList`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function fetchAllExercises(limit = 100) {
  const res = await fetch(`${BASE}?limit=${limit}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

// Normalize API exercise to our internal format
export function normalizeApiExercise(ex) {
  return {
    id: ex.id,
    name: ex.name,
    bodyPart: ex.bodyPart,
    target: ex.target,
    equipment: ex.equipment,
    gifUrl: ex.gifUrl,
    instructions: ex.instructions || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    custom: false,
    // Default: strength exercises are reps+weight; cardio/stretching are time
    trackingType: isTimeBased(ex) ? 'time' : 'reps',
  };
}

function isTimeBased(ex) {
  const timeKeywords = ['cardio', 'plank', 'hold', 'stretch', 'yoga'];
  const name = (ex.name || '').toLowerCase();
  const bp = (ex.bodyPart || '').toLowerCase();
  return timeKeywords.some(k => name.includes(k) || bp.includes(k));
}
