import { openDB } from 'idb';
import { memoizeOpen } from '../utils/idb';
import { SEED_FOODS } from './seedFoods';
import { toDateStr } from '../utils/dates';
import { tokenizeFood } from './nutrition';

const DB_NAME = 'nutricore-v1';
const DB_VERSION = 4;

// Stamp derived fields on a food before writing it: `tokens` feeds the nc_foods
// by_token multiEntry index used by searchFoodsDb. EVERY write path into nc_foods
// (saveFood, seed puts, FoodDbDownloader's bulk insert) must go through this.
export function prepFood(food) {
  return { ...food, tokens: tokenizeFood(food.name, food.brand) };
}

// Open the connection once and reuse it (memoizeOpen re-opens if it ever closes).
export const getDB = memoizeOpen(() =>
  openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('nc_foods')) {
        const f = db.createObjectStore('nc_foods', { keyPath: 'id', autoIncrement: true });
        f.createIndex('by_name', 'name');
        f.createIndex('by_custom', 'isCustom');
        f.createIndex('by_barcode', 'barcode', { unique: false });
      }
      if (!db.objectStoreNames.contains('nc_diary')) {
        const d = db.createObjectStore('nc_diary', { keyPath: 'id', autoIncrement: true });
        d.createIndex('by_date', 'date');
        d.createIndex('by_food', 'foodId');
      }
      if (!db.objectStoreNames.contains('nc_meals')) {
        db.createObjectStore('nc_meals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nc_goals')) {
        db.createObjectStore('nc_goals', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('nc_water')) {
        const w = db.createObjectStore('nc_water', { keyPath: 'id', autoIncrement: true });
        w.createIndex('by_date', 'date');
      }
      if (!db.objectStoreNames.contains('nc_profile')) {
        db.createObjectStore('nc_profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nc_favorites')) {
        db.createObjectStore('nc_favorites', { keyPath: 'foodId' });
      }
      if (!db.objectStoreNames.contains('nc_biometrics')) {
        const b = db.createObjectStore('nc_biometrics', { keyPath: 'id', autoIncrement: true });
        b.createIndex('by_date', 'date');
        b.createIndex('by_type', 'type');
      }
      if (!db.objectStoreNames.contains('nc_fasts')) {
        const fa = db.createObjectStore('nc_fasts', { keyPath: 'id', autoIncrement: true });
        fa.createIndex('by_start', 'startTs');
      }
      // v3: refresh seed foods with micronutrient data
      if (oldVersion < 3 && db.objectStoreNames.contains('nc_foods')) {
        const store = tx.objectStore('nc_foods');
        SEED_FOODS.forEach(food => store.put(prepFood(food)));
      }
      // v4: tokenized search. Add the multiEntry by_token index and backfill a
      // `tokens` array onto every existing food row. All requests run inside the
      // versionchange transaction (idb keeps it alive while we only await its own
      // cursor requests), so the migration is atomic with the version bump.
      if (oldVersion < 4) {
        const store = tx.objectStore('nc_foods');
        if (!store.indexNames.contains('by_token')) {
          store.createIndex('by_token', 'tokens', { multiEntry: true });
        }
        let cursor = await store.openCursor();
        while (cursor) {
          const f = cursor.value;
          if (!Array.isArray(f.tokens)) {
            f.tokens = tokenizeFood(f.name, f.brand);
            cursor.update(f);
          }
          cursor = await cursor.continue();
        }
      }
    },
    // If another tab has an older DB version open, close it so this upgrade can proceed
    blocking(_cv, _bv, event) {
      event.target.result.close();
    },
    // If this tab is being blocked by an older version, reload once the upgrade is done
    blocked() {
      window.location.reload();
    },
  })
);

// ── Init ───────────────────────────────────────────────────────────────────────

export async function initNutriCore() {
  const db = await getDB();

  // Seed meals
  const mealCount = (await db.getAll('nc_meals')).length;
  if (mealCount === 0) {
    const tx = db.transaction('nc_meals', 'readwrite');
    await tx.store.put({ id: 1, name: 'Breakfast', sortOrder: 0 });
    await tx.store.put({ id: 2, name: 'Lunch',     sortOrder: 1 });
    await tx.store.put({ id: 3, name: 'Dinner',    sortOrder: 2 });
    await tx.store.put({ id: 4, name: 'Snacks',    sortOrder: 3 });
    await tx.done;
  }

  // Seed default goals
  const defaultGoals = await db.get('nc_goals', 'default');
  if (!defaultGoals) {
    await db.put('nc_goals', { date: 'default', kcal: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
  }

  // Seed foods — only when the store is empty (first launch, or storage was evicted).
  // Deliberately NOT keyed on the presence/shape of food id 1: that heuristic re-put
  // all 60 seeds on every launch once the user deleted seed #1, resurrecting deleted
  // seeds and clobbering the user's edits forever. Micro-refresh for pre-v3 rows is
  // handled by the versioned upgrade path above.
  const foodCount = await db.count('nc_foods');
  if (foodCount === 0) {
    const tx = db.transaction('nc_foods', 'readwrite');
    for (const food of SEED_FOODS) {
      await tx.store.put(prepFood(food));
    }
    await tx.done;
  } else {
    // One-off repair: two seeds originally shipped with sourceDb 'custom', which made
    // them show up in the user's Custom tab labelled "Scanned". Relabel them in place
    // (only if they're still the unedited seed rows).
    for (const id of [13, 59]) {
      const f = await db.get('nc_foods', id);
      if (f && f.sourceDb === 'custom' && !f.isCustom &&
          (f.name === 'Whey Protein Powder' || f.name === 'Protein Bar')) {
        await db.put('nc_foods', { ...f, sourceDb: 'seed' });
      }
    }
  }

  await migrateOldMeals(db);
}

// Upgrade meals created before the wizard (a `Recipe` food without a `recipe` field)
// to the density-based model: per-100 g nutrition + named serving sizes + recipe
// definition, recomputed from the stored ingredients when present. Idempotent —
// once a meal has `recipe`, it's skipped.
const MEALS_MIGRATED_KEY = 'nc_meals_migrated_v1';

async function migrateOldMeals(db) {
  // One-time per device — skip the full nc_foods scan on every subsequent launch.
  try { if (localStorage.getItem(MEALS_MIGRATED_KEY)) return; } catch {}
  const r1 = v => +(Number(v) || 0).toFixed(1);
  const all = await db.getAll('nc_foods');
  const stale = all.filter(f => f && f.brand === 'Recipe' && !f.recipe);
  if (stale.length === 0) {
    try { localStorage.setItem(MEALS_MIGRATED_KEY, '1'); } catch {}
    return;
  }

  const tx = db.transaction('nc_foods', 'readwrite');
  for (const m of stale) {
    const unit = (m.servingUnit || 'serving');
    let updated;

    if (Array.isArray(m.ingredients) && m.ingredients.length) {
      const totalWeight = m.ingredients.reduce((s, i) => s + (i.amountG || 0), 0);
      const totals = m.ingredients.reduce((acc, { food, amountG }) => {
        const s = (amountG || 0) / 100;
        acc.kcal += (food?.kcal || 0) * s; acc.proteinG += (food?.proteinG || 0) * s;
        acc.carbsG += (food?.carbsG || 0) * s; acc.fatG += (food?.fatG || 0) * s;
        acc.fiberG += (food?.fiberG || 0) * s;
        return acc;
      }, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
      const servingsPerRecipe = m.recipePct ? Math.max(1, Math.round(100 / m.recipePct)) : 1;
      const primaryGrams = totalWeight > 0 ? totalWeight / servingsPerRecipe : 100;
      const dens = k => (totalWeight > 0 ? r1(totals[k] / totalWeight * 100) : (m[k] || 0));
      updated = {
        ...m,
        kcal: dens('kcal'), proteinG: dens('proteinG'), carbsG: dens('carbsG'),
        fatG: dens('fatG'), fiberG: dens('fiberG'),
        servingSizeG: r1(primaryGrams) || 100,
        servingUnit: unit,
        servingSizes: [{ name: unit, grams: r1(primaryGrams) || 0 }],
        recipe: {
          mode: 'servings', advanced: false,
          servings: [{ name: unit, value: servingsPerRecipe }],
          totalWeight: r1(totalWeight), category: '', notes: '',
        },
      };
    } else {
      // No ingredients to recompute from — keep nutrition as-is, just stamp metadata
      // so the meal opens in the wizard and logs by its named serving.
      const grams = m.servingSizeG || 100;
      updated = {
        ...m,
        servingUnit: unit,
        servingSizes: [{ name: unit, grams }],
        recipe: {
          mode: 'servings', advanced: false,
          servings: [{ name: unit, value: 1 }],
          totalWeight: grams, category: '', notes: '',
        },
      };
    }
    await tx.store.put(updated);
  }
  await tx.done;
  try { localStorage.setItem(MEALS_MIGRATED_KEY, '1'); } catch {}
}

// ── Foods ──────────────────────────────────────────────────────────────────────

export async function getAllFoods() {
  const db = await getDB();
  return db.getAll('nc_foods');
}

// First `limit` foods in primary-key order — the browse view's page. Screens grow
// the limit as the user scrolls instead of holding all ~14k foods in state.
export async function getFoodsPage(limit = 60) {
  const db = await getDB();
  return db.getAll('nc_foods', undefined, limit);
}

// Everything the user created, scanned, or built as a meal (small set; callers
// split recipes from plain custom foods via brand === 'Recipe').
export async function getCustomFoods() {
  const db = await getDB();
  const all = await db.getAll('nc_foods');
  return all.filter(f => f.isCustom || f.sourceDb === 'custom' || f.scanned);
}

// Indexed food search. Prefix-scans the by_token multiEntry index for the longest
// query token, then keeps candidates where every query token prefix-matches one of
// the food's tokens. Ranked like nutrition.js searchFoods(): whole-query name
// prefix first, then shorter names, then alphabetical.
export async function searchFoodsDb(query, { limit = 50 } = {}) {
  const raw = (query || '').trim().toLowerCase();
  const tokens = tokenizeFood(raw);
  if (!tokens.length) return [];
  const db = await getDB();

  const scanTok = tokens.reduce((a, b) => (b.length > a.length ? b : a));
  const range = IDBKeyRange.bound(scanTok, scanTok + '￿');
  const candidates = await db.getAllFromIndex('nc_foods', 'by_token', range);

  // multiEntry scans return one row per matching token — dedupe by id.
  const seen = new Set();
  const matches = [];
  for (const f of candidates) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const ftoks = Array.isArray(f.tokens) ? f.tokens : tokenizeFood(f.name, f.brand);
    if (tokens.every(t => ftoks.some(ft => ft.startsWith(t)))) matches.push(f);
  }

  matches.sort((a, b) => {
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    const aStarts = aName.startsWith(raw);
    const bStarts = bName.startsWith(raw);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    if (aName.length !== bName.length) return aName.length - bName.length;
    return aName.localeCompare(bName);
  });

  return matches.slice(0, limit);
}

export async function getFood(id) {
  const db = await getDB();
  return db.get('nc_foods', id);
}

export async function saveFood(food) {
  const db = await getDB();
  return db.put('nc_foods', prepFood(food));
}

export async function deleteFood(id) {
  const db = await getDB();
  return db.delete('nc_foods', id);
}

export async function getRecentFoods(limit = 30) {
  const db = await getDB();
  const entries = await db.getAllFromIndex('nc_diary', 'by_date');
  const seen = new Set();
  const foodIds = [];
  for (let i = entries.length - 1; i >= 0 && foodIds.length < limit; i--) {
    const fid = entries[i].foodId;
    if (fid == null) continue; // quick-add entries have no food row
    if (!seen.has(fid)) { seen.add(fid); foodIds.push(fid); }
  }
  const foods = await Promise.all(foodIds.map(id => db.get('nc_foods', id)));
  return foods.filter(Boolean);
}

export async function getFavoriteFoods() {
  const db = await getDB();
  const favs = await db.getAll('nc_favorites');
  const foods = await Promise.all(favs.map(f => db.get('nc_foods', f.foodId)));
  return foods.filter(Boolean);
}

export async function isFavorite(foodId) {
  const db = await getDB();
  return !!(await db.get('nc_favorites', foodId));
}

export async function toggleFavorite(foodId) {
  const db = await getDB();
  const existing = await db.get('nc_favorites', foodId);
  if (existing) {
    await db.delete('nc_favorites', foodId);
    return false;
  } else {
    await db.put('nc_favorites', { foodId, savedAt: new Date().toISOString() });
    return true;
  }
}

// ── Diary ──────────────────────────────────────────────────────────────────────

export async function getDiaryForDate(date) {
  const db = await getDB();
  const entries = await db.getAllFromIndex('nc_diary', 'by_date', date);
  entries.sort((a, b) => a.mealId - b.mealId || a.sortOrder - b.sortOrder);
  return entries;
}

// All diary entries with `date` in [startDate, endDate] (inclusive, local
// 'YYYY-MM-DD' strings). One index range scan — chronological by date.
export async function getDiaryForRange(startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  const entries = await db.getAllFromIndex('nc_diary', 'by_date', range);
  entries.sort((a, b) =>
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
    a.mealId - b.mealId || a.sortOrder - b.sortOrder);
  return entries;
}

export async function addDiaryEntry(entry) {
  const db = await getDB();
  const full = { ...entry, loggedAt: new Date().toISOString(), sortOrder: Date.now() };
  return db.add('nc_diary', full);
}

export async function updateDiaryEntry(entry) {
  const db = await getDB();
  return db.put('nc_diary', entry);
}

export async function deleteDiaryEntry(id) {
  const db = await getDB();
  return db.delete('nc_diary', id);
}

export async function copyEntriesToDate(entries, toDate) {
  const db = await getDB();
  const tx = db.transaction('nc_diary', 'readwrite');
  const base = Date.now();
  let i = 0;
  for (const e of entries) {
    const { id: _id, ...rest } = e;
    // base + i keeps the copies' relative order — a bare Date.now() is identical
    // across loop iterations, leaving the tiebreak-less sort order scrambled.
    await tx.store.add({ ...rest, date: toDate, loggedAt: new Date().toISOString(), sortOrder: base + i++ });
  }
  await tx.done;
}

// ── Meals ──────────────────────────────────────────────────────────────────────

export async function getMeals() {
  const db = await getDB();
  const meals = await db.getAll('nc_meals');
  return meals.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export async function getGoalsForDate(date) {
  const db = await getDB();
  const specific = await db.get('nc_goals', date);
  if (specific) return specific;
  return db.get('nc_goals', 'default');
}

export async function saveDefaultGoals(goals) {
  const db = await getDB();
  return db.put('nc_goals', { ...goals, date: 'default' });
}

// Per-date goal override (calorie cycling: e.g. higher on training days).
export async function saveGoalsForDate(date, goals) {
  const db = await getDB();
  return db.put('nc_goals', { ...goals, date });
}
export async function deleteGoalsForDate(date) {
  const db = await getDB();
  try { await db.delete('nc_goals', date); } catch {}
}
export async function hasDateGoals(date) {
  const db = await getDB();
  return !!(await db.get('nc_goals', date));
}

// ── Water ──────────────────────────────────────────────────────────────────────

export async function getWaterForDate(date) {
  const db = await getDB();
  const logs = await db.getAllFromIndex('nc_water', 'by_date', date);
  return logs.reduce((sum, l) => sum + l.amountMl, 0);
}

// Total water per day over [startDate, endDate] as { 'YYYY-MM-DD': mL }.
// Days with no logs are absent from the map.
export async function getWaterForRange(startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  const logs = await db.getAllFromIndex('nc_water', 'by_date', range);
  const byDate = {};
  for (const l of logs) byDate[l.date] = (byDate[l.date] || 0) + (l.amountMl || 0);
  return byDate;
}

export async function addWater(date, amountMl) {
  const db = await getDB();
  return db.add('nc_water', { date, amountMl, loggedAt: new Date().toISOString() });
}

// Removes the most recent water log for the date and returns the amount removed
// (0 if there was nothing to remove), so callers can adjust totals by what was
// actually logged rather than assuming a fixed glass size.
export async function removeLastWater(date) {
  const db = await getDB();
  const logs = await db.getAllFromIndex('nc_water', 'by_date', date);
  if (!logs.length) return 0;
  logs.sort((a, b) => a.loggedAt < b.loggedAt ? 1 : -1);
  await db.delete('nc_water', logs[0].id);
  return logs[0].amountMl || 0;
}

// ── Barcode lookup ─────────────────────────────────────────────────────────────

export async function getFoodByBarcode(barcode) {
  const db = await getDB();
  const idx = db.transaction('nc_foods').store.index('by_barcode');
  const results = await idx.getAll(barcode);
  return results[0] || null;
}

// ── Calorie history (aggregate diary kcal by date) ────────────────────────────

export async function getCalorieHistory(startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  const entries = await db.getAllFromIndex('nc_diary', 'by_date', range);
  const byDate = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = 0;
    byDate[e.date] += (e.amountG / 100) * (e.foodKcal || 0);
  }
  const result = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    const d = toDateStr(cur);
    result.push({ date: d, kcal: Math.round(byDate[d] || 0) });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ── Biometrics ─────────────────────────────────────────────────────────────────

export async function addBiometric(date, type, value) {
  const db = await getDB();
  return db.add('nc_biometrics', { date, type, value, recordedAt: new Date().toISOString() });
}

export async function getBiometricsInRange(type, startDate, endDate) {
  const db = await getDB();
  // Range scan on the by_date index (results come back date-ordered) instead of a
  // full-store scan; only the type filter is done in JS.
  const range = IDBKeyRange.bound(startDate, endDate);
  const inRange = await db.getAllFromIndex('nc_biometrics', 'by_date', range);
  return inRange.filter(b => b.type === type);
}

// ── Fasting ────────────────────────────────────────────────────────────────────

export async function getActiveFast() {
  const db = await getDB();
  const all = await db.getAll('nc_fasts');
  return all.find(f => !f.endTs) || null;
}

export async function startFast(protocol, targetSecs) {
  const db = await getDB();
  const active = await getActiveFast();
  if (active) {
    await db.put('nc_fasts', { ...active, endTs: new Date().toISOString(), completed: false });
  }
  return db.add('nc_fasts', {
    startTs: new Date().toISOString(),
    endTs: null,
    targetSecs,
    protocol,
    completed: false,
  });
}

export async function stopFast(id, completed) {
  const db = await getDB();
  const fast = await db.get('nc_fasts', id);
  if (!fast) return;
  return db.put('nc_fasts', { ...fast, endTs: new Date().toISOString(), completed });
}

export async function getFastHistory(limit = 20) {
  const db = await getDB();
  const all = await db.getAll('nc_fasts');
  return all
    .filter(f => f.endTs)
    .sort((a, b) => (b.startTs > a.startTs ? 1 : -1))
    .slice(0, limit);
}

// ── Profile ────────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  id: 1,
  sex: 'male',
  dateOfBirth: '1990-01-01',
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderatelyActive',
  goalType: 'maintain',
  goalRateKgWeek: 0,
  goalWeightKg: null,
  waterGoalMl: 2000,
  onboardingComplete: false,
  unitWeight: 'kg',   // 'kg' | 'lbs'
  unitWater: 'ml',    // 'ml' | 'floz'
  unitEnergy: 'kcal', // 'kcal' | 'kj'
};

export async function getProfile() {
  const db = await getDB();
  return (await db.get('nc_profile', 1)) || DEFAULT_PROFILE;
}

export async function saveProfile(profile) {
  const db = await getDB();
  return db.put('nc_profile', { ...profile, id: 1 });
}

// ── Streak ─────────────────────────────────────────────────────────────────────

export async function getLoggingStreak() {
  const db = await getDB();
  const all = await db.getAll('nc_diary');
  const daysWithEntries = new Set(all.map(e => e.date));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let check = new Date(today);
  let streak = 0;

  if (!daysWithEntries.has(toDateStr(check))) {
    check.setDate(check.getDate() - 1);
  }

  while (true) {
    const d = toDateStr(check);
    if (daysWithEntries.has(d)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
