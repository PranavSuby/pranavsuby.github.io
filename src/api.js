import bundledExercises from './data/exercises.json';

function searchBundled(query) {
  const q = query.toLowerCase();
  return bundledExercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 30);
}

function filterBundled(bodyPart) {
  if (!bodyPart || bodyPart === 'All') return bundledExercises.slice(0, 60);
  return bundledExercises.filter(e => e.bodyPart === bodyPart).slice(0, 60);
}

export async function fetchExercisesByBodyPart(bodyPart, _limit = 60) {
  return filterBundled(bodyPart).map(normalizeApiExercise);
}

export async function fetchExercisesByName(name) {
  return searchBundled(name).map(normalizeApiExercise);
}

export async function fetchExerciseById(id) {
  const ex = bundledExercises.find(e => e.id === id);
  if (!ex) throw new Error('Exercise not found');
  return normalizeApiExercise(ex);
}

export async function fetchBodyPartList() {
  return [...new Set(bundledExercises.map(e => e.bodyPart))].sort();
}

export async function fetchAllExercises(limit = 100) {
  return bundledExercises.slice(0, limit).map(normalizeApiExercise);
}

export function normalizeApiExercise(ex) {
  return {
    id: ex.id,
    name: ex.name,
    bodyPart: ex.bodyPart,
    target: ex.target || ex.bodyPart,
    equipment: ex.equipment,
    imageUrl: ex.imageUrl || null,
    instructions: ex.instructions || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    custom: false,
    trackingType: ex.trackingType || (isTimeBased(ex) ? 'time' : 'reps'),
  };
}

function isTimeBased(ex) {
  const timeKeywords = ['cardio', 'plank', 'hold', 'stretch', 'yoga'];
  const name = (ex.name || '').toLowerCase();
  return timeKeywords.some(k => name.includes(k));
}
