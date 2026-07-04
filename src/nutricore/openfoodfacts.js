// Open Food Facts helpers — shared by the barcode scanner and online text search so
// foods unknown to the local DB can still be looked up online.

export function mapOFFProduct(p, barcode = null) {
  if (!p) return null;
  const n = p.nutriments || {};
  const kcal = parseFloat(n['energy-kcal_100g'] || n['energy_kcal_100g'] || 0);
  const name = p.product_name || p.abbreviated_product_name || p.generic_name || '';
  if (!name || !(kcal > 0)) return null; // skip unusable rows
  return {
    name,
    brand:        p.brands || null,
    category:     'other',
    sourceDb:     'custom',
    barcode:      barcode || p.code || null,
    kcal,
    proteinG:     parseFloat(n.proteins_100g      || 0),
    carbsG:       parseFloat(n.carbohydrates_100g || 0),
    fatG:         parseFloat(n.fat_100g           || 0),
    fiberG:       parseFloat(n.fiber_100g         || 0),
    sugarG:       parseFloat(n.sugars_100g        || 0),
    sodiumMg:     parseFloat((n.sodium_100g       || 0) * 1000),
    servingSizeG: 100,
    isCustom:     false,
  };
}

// Returns an array of mapped food objects (no DB id yet — saved on selection).
export async function searchOFF(query, { signal } = {}) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl'
    + `?search_terms=${encodeURIComponent(query)}`
    + '&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n'
    + '&fields=product_name,abbreviated_product_name,generic_name,brands,code,nutriments';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  const seen = new Set();
  const out = [];
  for (const p of data.products || []) {
    const food = mapOFFProduct(p);
    if (!food) continue;
    const key = `${food.name}|${food.brand || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(food);
  }
  return out;
}
