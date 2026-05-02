// db.js — IndexedDB via idb library
import { openDB } from 'idb';

const DB_NAME = 'gymapp';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Custom exercises
      if (!db.objectStoreNames.contains('exercises')) {
        const ex = db.createObjectStore('exercises', { keyPath: 'id' });
        ex.createIndex('name', 'name');
        ex.createIndex('bodyPart', 'bodyPart');
        ex.createIndex('custom', 'custom');
      }
      // Workout templates
      if (!db.objectStoreNames.contains('workouts')) {
        const w = db.createObjectStore('workouts', { keyPath: 'id' });
        w.createIndex('name', 'name');
      }
      // Logged sessions
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('workoutId', 'workoutId');
      }
    },
  });
}

// ── Exercises ────────────────────────────────────────────────────────────────
export async function saveExercise(exercise) {
  const db = await getDB();
  await db.put('exercises', exercise);
}

export async function getAllCustomExercises() {
  const db = await getDB();
  return db.getAllFromIndex('exercises', 'custom', IDBKeyRange.only(true));
}

export async function deleteExercise(id) {
  const db = await getDB();
  await db.delete('exercises', id);
}

// ── Workouts ────────────────────────────────────────────────────────────────
export async function saveWorkout(workout) {
  const db = await getDB();
  await db.put('workouts', workout);
}

export async function getAllWorkouts() {
  const db = await getDB();
  return db.getAll('workouts');
}

export async function getWorkout(id) {
  const db = await getDB();
  return db.get('workouts', id);
}

export async function deleteWorkout(id) {
  const db = await getDB();
  await db.delete('workouts', id);
}

// ── Sessions ────────────────────────────────────────────────────────────────
export async function saveSession(session) {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getAllSessions() {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getSession(id) {
  const db = await getDB();
  return db.get('sessions', id);
}

export async function deleteSession(id) {
  const db = await getDB();
  await db.delete('sessions', id);
}
