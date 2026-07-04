// Best-effort online enrichment from the wger open exercise database (CORS-enabled,
// no API key). Data is community-sourced and sometimes sparse, so every field is
// optional and callers should treat results as suggestions, not ground truth.

const API = 'https://wger.de/api/v2';
const EN = 2; // wger language id for English

function stripHtml(html) {
  if (!html) return [];
  // Split on block tags into lines, strip remaining tags & entities, keep non-empty.
  const text = html
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ');
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
}

const CATEGORY_TO_BODYPART = {
  Abs: 'waist', Arms: 'upper arms', Back: 'back', Calves: 'lower legs',
  Chest: 'chest', Legs: 'upper legs', Shoulders: 'shoulders', Cardio: 'cardio',
};
const EQUIP_MAP = {
  'none (bodyweight exercise)': 'body weight', Barbell: 'barbell', Dumbbell: 'dumbbell',
  'Kettlebell': 'kettlebell', 'SZ-Bar': 'ez barbell', 'Pull-up bar': 'body weight',
  'Gym mat': 'body weight', Bench: 'body weight', 'Incline bench': 'body weight',
  'Swiss Ball': 'exercise ball', 'Cable': 'cable',
};

// Search wger by name → [{ name, baseId }]
export async function searchWger(query, { signal } = {}) {
  const url = `${API}/exercise-translation/?format=json&language=${EN}&limit=8&name=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('lookup failed');
  const data = await res.json();
  const seen = new Set();
  const out = [];
  for (const r of data.results || []) {
    const baseId = r.exercise;
    if (!baseId || seen.has(baseId)) continue;
    seen.add(baseId);
    out.push({ name: r.name, baseId });
  }
  return out;
}

// Fetch full info for a base id → { name, instructions[], bodyPart, equipment }
export async function getWgerInfo(baseId, { signal } = {}) {
  const res = await fetch(`${API}/exerciseinfo/${baseId}/?format=json`, { signal });
  if (!res.ok) throw new Error('info failed');
  const d = await res.json();
  const en = (d.translations || []).find(t => t.language === EN) || (d.translations || [])[0] || {};
  const equipName = (d.equipment || [])[0]?.name;
  return {
    name: en.name || '',
    instructions: stripHtml(en.description),
    bodyPart: CATEGORY_TO_BODYPART[d.category?.name] || '',
    equipment: EQUIP_MAP[equipName] || (equipName ? '' : ''),
  };
}
