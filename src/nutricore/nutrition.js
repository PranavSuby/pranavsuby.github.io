// All amounts per 100g stored in DB; scale by (amountG / 100) for actual values.

// Single source of truth: every per-100 g nutrient field a food object can carry.
// Diary entries persist each one as `food<Key>` (see entryKey), computeTotals sums
// them all, and recipes aggregate them across ingredients. Add new nutrients HERE
// (matching the field name in FoodDbDownloader's expand()) and every layer follows.
export const NUTRIENT_KEYS = [
  // Macros
  'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'addedSugarG', 'starchG',
  // Lipids
  'satFatG', 'transFatG', 'monoFatG', 'polyFatG', 'cholesterolMg',
  'omega3G', 'omega3AlaG', 'omega3EpaG', 'omega3DhaG',
  'omega6G', 'omega6LaG', 'omega6AaG',
  // Minerals
  'sodiumMg', 'calciumMg', 'ironMg', 'magnesiumMg', 'potassiumMg', 'zincMg',
  'copperMg', 'seleniumMcg', 'phosphorusMg', 'manganeseMg',
  // Vitamins
  'vitaminAMcg', 'vitaminCMg', 'vitaminDMcg', 'vitaminEMg', 'vitaminKMcg',
  'thiamineMg', 'riboflavinMg', 'niacinMg', 'b5Mg', 'b6Mg', 'biotinMcg',
  'folateMcg', 'b12Mcg', 'cholineMg',
  // Other
  'waterG', 'caffeineMg', 'alcoholG',
  // Amino acids
  'tryptophanG', 'threonineG', 'isoleucineG', 'leucineG', 'lysineG', 'methionineG',
  'cystineG', 'phenylalanineG', 'tyrosineG', 'valineG', 'histidineG',
];

// Diary-entry field name for a nutrient key: 'proteinG' → 'foodProteinG'.
// Matches the field names entries have always used, so old stored entries keep working.
export function entryKey(k) {
  return 'food' + k[0].toUpperCase() + k.slice(1);
}

const ENTRY_KEYS = NUTRIENT_KEYS.map(k => [k, entryKey(k)]);

// Food-shaped object → the per-100 g `food*` fields persisted on a diary entry.
export function foodToEntryFields(food) {
  const out = {};
  for (const [k, ek] of ENTRY_KEYS) out[ek] = food[k] || 0;
  return out;
}

// Reverse: rebuild the per-100 g nutrient fields from a stored diary entry.
export function entryToNutrients(entry) {
  const out = {};
  for (const [k, ek] of ENTRY_KEYS) out[k] = entry[ek] || 0;
  return out;
}

export function entryKcal(entry) {
  return ((entry.foodKcal || 0) * (entry.amountG || 0)) / 100;
}

// Entries store per-100 g `food*` values plus amountG; scale each by amountG/100.
export function computeTotals(entries) {
  const acc = {};
  for (const k of NUTRIENT_KEYS) acc[k] = 0;
  for (const e of entries) {
    const s = e.amountG / 100;
    for (const [k, ek] of ENTRY_KEYS) acc[k] += (e[ek] || 0) * s;
  }
  return acc;
}

export function computePreview(food, amountG) {
  const s = amountG / 100;
  return {
    kcal:     Math.round((food.kcal     || 0) * s),
    proteinG: +((food.proteinG || 0) * s).toFixed(1),
    carbsG:   +((food.carbsG   || 0) * s).toFixed(1),
    fatG:     +((food.fatG     || 0) * s).toFixed(1),
    fiberG:   +((food.fiberG   || 0) * s).toFixed(1),
  };
}

// Unit conversion to grams
const UNIT_CONVERSIONS = {
  g:       (a) => a,
  oz:      (a) => a * 28.3495,
  lb:      (a) => a * 453.592,
  kg:      (a) => a * 1000,
  mL:      (a) => a,
  'fl oz': (a) => a * 29.5735,
  cup:     (a) => a * 240,
  tbsp:    (a) => a * 14.787,
  tsp:     (a) => a * 4.929,
};

export function toGrams(amount, unit, foodServingSizeG = 100) {
  if (unit === 'serving') return amount * foodServingSizeG;
  const fn = UNIT_CONVERSIONS[unit];
  return fn ? fn(amount) : amount;
}

export const UNITS = ['g', 'oz', 'lb', 'mL', 'fl oz', 'cup', 'tbsp', 'tsp', 'serving'];

// Weight-based measuring units that apply to any food, appended after a food's
// named serving sizes in the unit picker. Volume units (cup/tbsp/tsp/mL) are
// deliberately NOT offered generically: converting them to grams needs the food's
// density, and assuming water density (1 g/mL) silently mis-logs dense/light foods
// by up to 3×. Foods with a real volume portion carry it as a named serving with
// its true gram weight, which takes precedence anyway. UNIT_CONVERSIONS keeps the
// volume entries so previously-logged entries with those units still resolve.
const WEIGHT_UNITS = ['g', 'oz', 'lb'];

// A food's named serving sizes. Meals can carry several (e.g. "full recipe", "bowl");
// a plain food has the single serving implied by servingUnit/servingSizeG.
export function getServings(food) {
  if (food.servingSizes && food.servingSizes.length) return food.servingSizes;
  return [{ name: food.servingUnit || 'serving', grams: food.servingSizeG || 100 }];
}

// Unit picker options for a food: its named servings first, then weight units.
// Weight units that collide with a named serving's name are dropped — the named
// serving wins in toGramsForFood, so listing both would show a duplicate option.
export function servingUnitOptions(food) {
  const named = getServings(food).map(s => s.name);
  return [...named, ...WEIGHT_UNITS.filter(u => !named.includes(u))];
}

// Resolve any chosen unit (a named serving or a weight unit) to grams.
export function toGramsForFood(food, amount, unit) {
  const named = getServings(food).find(s => s.name === unit);
  if (named) return amount * (named.grams || food.servingSizeG || 100);
  if (unit === 'serving') return amount * (food.servingSizeG || 100);
  const fn = UNIT_CONVERSIONS[unit];
  return fn ? fn(amount) : amount;
}

export function unitLabel(amount, unit) {
  const rounded = Number.isInteger(amount) ? amount : +amount.toFixed(1);
  return `${rounded} ${unit}`;
}

// Search tokens for a food: unique lowercase words from name + brand. Also used to
// tokenize queries (pass the query as `name`) so both sides split identically.
// The nc_foods `by_token` index (db.js) is built from these.
export function tokenizeFood(name, brand) {
  const s = `${name || ''} ${brand || ''}`.toLowerCase();
  return Array.from(new Set(s.split(/[^\p{L}\p{N}]+/u).filter(Boolean)));
}

// Tokenized search — prefix match on each whitespace-separated token
export function searchFoods(foods, query) {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const tokens = raw.split(/\s+/).filter(Boolean);

  const matches = foods.filter(f => {
    const haystack = `${f.name} ${f.brand || ''}`.toLowerCase();
    return tokens.every(t => haystack.includes(t));
  });

  matches.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aStarts = aName.startsWith(raw);
    const bStarts = bName.startsWith(raw);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return aName.localeCompare(bName);
  });

  return matches;
}

export function fmt(n, decimals = 0) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
