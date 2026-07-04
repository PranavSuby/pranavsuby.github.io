import bundled from '../data/exercises.json';

export const EQUIPMENT_LIST = [
  'barbell', 'cable', 'dumbbell', 'ez barbell', 'kettlebell', 'leverage machine',
  'resistance band', 'smith machine', 'body weight', 'assisted', 'weighted',
];

export const BODY_PARTS = [
  'back', 'cardio', 'chest', 'lower arms', 'lower legs', 'neck',
  'shoulders', 'upper arms', 'upper legs', 'waist',
];

export function searchAndFilter({ query = '', bodyPart = '', equipment = '' }, customExercises = []) {
  const q = query.toLowerCase().replace(/-/g, ' ');
  const all = [...customExercises, ...bundled];
  return all.filter(e => {
    const name = (e.name || '').toLowerCase().replace(/-/g, ' ');
    if (q && !name.includes(q)) return false;
    if (bodyPart && e.bodyPart !== bodyPart) return false;
    if (equipment && e.equipment !== equipment) return false;
    return true;
  });
}

export function getExerciseById(id) {
  return bundled.find(e => e.id === id) || null;
}

export function getExerciseByName(name) {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return bundled.find(e => (e.name || '').trim().toLowerCase() === k) || null;
}

export const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
