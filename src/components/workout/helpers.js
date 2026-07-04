import { genId } from '../../utils/id';

export function makeEmptyRoutine() {
  return {
    id: genId(),
    title: '',
    defaultRest: 90,
    exercises: [],
    createdAt: new Date().toISOString(),
  };
}

export function makeEmptyExercise(ex, defaultUnits = 'kg') {
  return {
    id: ex.id ?? genId(),
    name: ex.name,
    bodyPart: ex.bodyPart ?? '',
    equipment: ex.equipment ?? '',
    trackingType: ex.trackingType ?? 'reps',
    units: ex.units ?? defaultUnits,   // per-exercise weight unit
    restTime: ex.restTime ?? null,     // per-exercise rest override (null = routine default)
    note: ex.note ?? '',
    sets: [{ reps: '', weight: '' }],
  };
}
