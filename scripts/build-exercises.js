/* Merge curated extra exercises (scripts/extra-exercises.js) into the bundled
   src/data/exercises.json. Idempotent: dedupes by normalized name, assigns stable ids,
   keeps the file sorted by name. Run with: npm run build:exercises */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'src', 'data', 'exercises.json');
const extra = require('./extra-exercises');

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const existing = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const haveNames = new Set(existing.map((e) => norm(e.name)));

let added = 0;
let n = 1;
for (const ex of extra) {
  const key = norm(ex.name);
  if (haveNames.has(key)) continue;
  haveNames.add(key);
  existing.push({
    id: `curated_${String(n++).padStart(4, '0')}`,
    name: ex.name,
    bodyPart: ex.bodyPart,
    target: ex.target,
    equipment: ex.equipment || 'body only',
    secondaryMuscles: ex.secondaryMuscles || [],
    instructions: ex.instructions || [],
    trackingType: ex.trackingType || 'reps',
    imageUrl: ex.imageUrl ?? null,
  });
  added++;
}

existing.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(DATA, JSON.stringify(existing) + '\n');
console.log(`Merged ${added} new exercises (skipped ${extra.length - added} duplicates). Total: ${existing.length}.`);
