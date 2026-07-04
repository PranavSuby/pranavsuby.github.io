import { openDB } from 'idb';
import { memoizeOpen } from './utils/idb';

const DB_NAME = 'gymapp-v2';
const DB_VERSION = 2;

// Open the connection once and reuse it (memoizeOpen re-opens if it ever closes).
const getDB = memoizeOpen(() =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('routines')) {
        const r = db.createObjectStore('routines', { keyPath: 'id' });
        r.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('routineId', 'routineId');
      }
      if (!db.objectStoreNames.contains('customExercises')) {
        const c = db.createObjectStore('customExercises', { keyPath: 'id' });
        c.createIndex('bodyPart', 'bodyPart');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v2: progress photos (stored as compressed data URLs).
      if (!db.objectStoreNames.contains('progressPhotos')) {
        const p = db.createObjectStore('progressPhotos', { keyPath: 'id' });
        p.createIndex('date', 'date');
      }
    },
  })
);

// Exposed for the shared backup utility (src/utils/backup.js).
export { getDB as openGymDB };

// ── Routines ───────────────────────────────────────────────────────────────────
export async function getAllRoutines() {
  const db = await getDB();
  return db.getAll('routines');
}
export async function saveRoutine(routine) {
  const db = await getDB();
  return db.put('routines', routine);
}
export async function deleteRoutine(id) {
  const db = await getDB();
  return db.delete('routines', id);
}

// ── Sessions ───────────────────────────────────────────────────────────────────
export async function getAllSessions() {
  const db = await getDB();
  return db.getAll('sessions');
}
export async function getSession(id) {
  const db = await getDB();
  return db.get('sessions', id);
}
export async function saveSession(session) {
  const db = await getDB();
  return db.put('sessions', session);
}
export async function deleteSession(id) {
  const db = await getDB();
  return db.delete('sessions', id);
}

// Returns the most recent completed sets for a given exercise name, plus the unit
// they were logged in — callers MUST convert weights if their live unit differs.
// Sessions where the exercise was present but no set was completed are skipped, so
// one skipped day doesn't hide months of older history.
export async function getLastSetsForExercise(exerciseName) {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'date');
  for (let i = all.length - 1; i >= 0; i--) {
    const ex = all[i].exercises?.find(e => e.name === exerciseName);
    if (!ex) continue;
    const completed = (ex.sets || []).filter(s => s.completed);
    if (completed.length) return { sets: completed, units: ex.units ?? 'kg' };
  }
  return { sets: [], units: null };
}

// Returns all sessions containing a given exercise name, sorted newest first
export async function getSessionsForExercise(exerciseName) {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'date');
  return all
    .filter(s => s.exercises?.some(e => e.name === exerciseName))
    .reverse();
}

// ── Custom Exercises ───────────────────────────────────────────────────────────
export async function getAllCustomExercises() {
  const db = await getDB();
  return db.getAll('customExercises');
}
export async function saveCustomExercise(ex) {
  const db = await getDB();
  return db.put('customExercises', ex);
}
export async function deleteCustomExercise(id) {
  const db = await getDB();
  return db.delete('customExercises', id);
}

// ── Progress Photos ──────────────────────────────────────────────────────────────
export async function getAllProgressPhotos() {
  const db = await getDB();
  const all = await db.getAllFromIndex('progressPhotos', 'date');
  return all.reverse(); // newest first
}
export async function saveProgressPhoto(photo) {
  const db = await getDB();
  return db.put('progressPhotos', photo);
}
export async function deleteProgressPhoto(id) {
  const db = await getDB();
  return db.delete('progressPhotos', id);
}

// ── Settings ───────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  key: 'main',
  units: 'kg',
  defaultRest: 90,
  keepAwake: true,
  rpeEnabled: false,
};

export async function getSettings() {
  const db = await getDB();
  return (await db.get('settings', 'main')) || DEFAULT_SETTINGS;
}
export async function saveSettings(settings) {
  const db = await getDB();
  return db.put('settings', { ...settings, key: 'main' });
}

// ── Active Session (survives page refresh) ────────────────────────────────────
export async function saveActiveSession(session) {
  const db = await getDB();
  await db.put('settings', { key: 'activeSession', value: session });
}
export async function getActiveSession() {
  const db = await getDB();
  const row = await db.get('settings', 'activeSession');
  return row?.value ?? null;
}
export async function clearActiveSession() {
  const db = await getDB();
  try { await db.delete('settings', 'activeSession'); } catch {}
}

// ── Last Workout Settings ─────────────────────────────────────────────────────
export async function saveLastWorkoutSettings(ws) {
  const db = await getDB();
  await db.put('settings', { key: 'lastWorkoutSettings', value: ws });
}
export async function getLastWorkoutSettings() {
  const db = await getDB();
  const row = await db.get('settings', 'lastWorkoutSettings');
  return row?.value ?? { defaultRestTime: null, intensityMode: 'none' };
}
