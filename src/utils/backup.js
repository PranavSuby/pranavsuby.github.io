// Unified backup/restore for every app's IndexedDB database.
//
// A backup is a single JSON file containing a full dump of every object store in
// both databases. Restore clears each store and reloads it, so it is a faithful
// replace (not a merge). This is the only safety net against browser storage
// eviction / device loss for these no-backend apps.

import { openGymDB } from '../db';
import { getDB as openNutriDB, initNutriCore } from '../nutricore/db';

export const BACKUP_FORMAT = 'pranav-tools-backup';
export const BACKUP_VERSION = 1;

// name → function returning an opened idb database (schema already created).
const DATABASES = {
  'gymapp-v2': openGymDB,
  'nutricore-v1': async () => { await initNutriCore(); return openNutriDB(); },
};

async function dumpDatabase(open) {
  const db = await open();
  const dump = {};
  for (const store of db.objectStoreNames) {
    dump[store] = await db.getAll(store);
  }
  return dump;
}

// Build the full backup object (caller decides how to deliver it).
// A database that fails to dump aborts the whole export — a backup silently missing
// an entire app's data is worse than no backup, since it looks complete.
export async function buildBackup() {
  const data = {};
  for (const [name, open] of Object.entries(DATABASES)) {
    try {
      data[name] = await dumpDatabase(open);
    } catch (err) {
      throw new Error(`Backup failed: could not read database "${name}" (${err?.message || err}). Close other tabs of this app and try again.`);
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'pranavsuby.github.io',
    data,
  };
}

// Count records in a backup (for confirmation UI).
export function countRecords(backup) {
  let n = 0;
  for (const stores of Object.values(backup?.data || {})) {
    for (const rows of Object.values(stores || {})) {
      if (Array.isArray(rows)) n += rows.length;
    }
  }
  return n;
}

// Trigger a file download of the current backup.
export async function downloadBackup() {
  const backup = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pranav-tools-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return countRecords(backup);
}

export function parseBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Not a valid backup file (bad JSON).'); }
  if (parsed?.format !== BACKUP_FORMAT || !parsed.data) {
    throw new Error('This file is not a Pranav Tools backup.');
  }
  return parsed;
}

// Restore a parsed backup. For each database present in the file, ALL of its stores
// are cleared and reloaded in a single transaction, so a restore is all-or-nothing per
// database — a bad row can't leave the device half backup / half old data. Every row is
// validated against the store's keyPath BEFORE anything is cleared.
export async function restoreBackup(backup) {
  // Pass 1: open both DBs and validate every row of every store up front.
  const plans = [];
  for (const [name, open] of Object.entries(DATABASES)) {
    const stores = backup.data?.[name];
    if (!stores) continue;
    const db = await open();
    const storeNames = Object.keys(stores).filter(s => db.objectStoreNames.contains(s));
    for (const storeName of storeNames) {
      const rows = stores[storeName] || [];
      if (!Array.isArray(rows)) throw new Error(`Backup is corrupt: "${storeName}" is not a list.`);
      const keyPath = db.transaction(storeName).store.keyPath;
      for (const row of rows) {
        if (typeof row !== 'object' || row === null) {
          throw new Error(`Backup is corrupt: "${storeName}" contains an invalid record.`);
        }
        if (typeof keyPath === 'string' && row[keyPath] === undefined) {
          throw new Error(`Backup is corrupt: a "${storeName}" record is missing its "${keyPath}" key.`);
        }
      }
    }
    plans.push({ db, stores, storeNames });
  }

  // Pass 2: apply — one readwrite transaction spanning all stores of each database.
  let restored = 0;
  for (const { db, stores, storeNames } of plans) {
    if (storeNames.length === 0) continue;
    const tx = db.transaction(storeNames, 'readwrite');
    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      await store.clear();
      for (const row of stores[storeName] || []) {
        await store.put(row);
        restored++;
      }
    }
    await tx.done;
  }

  // Restored data may predate one-time localStorage-flagged migrations/downloads, and
  // those flags live outside the backup. Clear them so the food-DB downloader re-checks
  // its data and the meals migration re-scans instead of trusting stale flags.
  try {
    localStorage.removeItem('nc_food_db_v');
    localStorage.removeItem('nc_meals_migrated_v1');
  } catch {}

  return restored;
}

// Merge a parsed backup into existing data WITHOUT clearing (upsert by keyPath).
// Used by CSV import, which adds to rather than replaces existing records.
export async function mergeBackup(backup) {
  let merged = 0;
  for (const [name, open] of Object.entries(DATABASES)) {
    const stores = backup.data?.[name];
    if (!stores) continue;
    const db = await open();
    for (const storeName of Object.keys(stores)) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const rows = stores[storeName] || [];
      const tx = db.transaction(storeName, 'readwrite');
      for (const row of rows) {
        await tx.store.put(row);
        merged++;
      }
      await tx.done;
    }
  }
  return merged;
}

// Read a File object and restore it.
export async function importBackupFile(file) {
  const text = await file.text();
  const backup = parseBackup(text);
  const restored = await restoreBackup(backup);
  return { restored, exportedAt: backup.exportedAt };
}
