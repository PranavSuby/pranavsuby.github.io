#!/usr/bin/env node
/**
 * NutriCore Food Database Builder
 *
 * Downloads free public food databases and generates public/foods-db.json
 * Run: npm run build:foods
 *
 * Sources (all free, no license required):
 *   - USDA SR Legacy    ~8,700 US foods,  70+ nutrients
 *   - USDA Foundation   ~1,600 US foods,  80+ nutrients
 *   - USDA FNDDS        ~8,000 US foods,  65+ nutrients
 *   - CNF 2015          ~5,600 CA foods,  65+ nutrients  (optional, see notes)
 *
 * Output: public/foods-db.json  (~1.5–3 MB uncompressed, ~500 KB gzipped)
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

// ── Auto-install adm-zip if missing ──────────────────────────────────────────
let AdmZip;
try { AdmZip = require('adm-zip'); } catch {
  console.log('📦 Installing adm-zip (one-time)…');
  require('child_process').execSync('npm install adm-zip --no-save', { stdio: 'inherit' });
  AdmZip = require('adm-zip');
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const CACHE_DIR  = path.join(ROOT, '.food-cache');
const OUT_FILE   = path.join(ROOT, 'public', 'foods-db.json');

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── USDA nutrient ID → { key: compact, full: IndexedDB field name } ──────────
// Compact keys minimise JSON size (~30% smaller than full field names)
const NUTRIENTS = {
  1008: { k: 'k',   full: 'kcal'         },
  1003: { k: 'p',   full: 'proteinG'     },
  1005: { k: 'cb',  full: 'carbsG'       },
  1004: { k: 'f',   full: 'fatG'         },
  1079: { k: 'fi',  full: 'fiberG'       },
  2000: { k: 'sg',  full: 'sugarG'       },
  1093: { k: 'na',  full: 'sodiumMg'     },
  1087: { k: 'ca',  full: 'calciumMg'    },
  1089: { k: 'fe',  full: 'ironMg'       },
  1090: { k: 'mg',  full: 'magnesiumMg'  },
  1092: { k: 'kp',  full: 'potassiumMg'  },
  1095: { k: 'zn',  full: 'zincMg'       },
  1098: { k: 'cu',  full: 'copperMg'     },
  1103: { k: 'se',  full: 'seleniumMcg'  },
  1106: { k: 'va',  full: 'vitaminAMcg'  },
  1162: { k: 'vc',  full: 'vitaminCMg'   },
  1114: { k: 'vd',  full: 'vitaminDMcg'  },
  1109: { k: 've',  full: 'vitaminEMg'   },
  1185: { k: 'vk',  full: 'vitaminKMcg'  },
  1165: { k: 'b1',  full: 'thiamineMg'   },
  1166: { k: 'b2',  full: 'riboflavinMg' },
  1167: { k: 'b3',  full: 'niacinMg'     },
  1175: { k: 'b6',  full: 'b6Mg'         },
  1177: { k: 'fo',  full: 'folateMcg'    },
  1178: { k: 'b12', full: 'b12Mcg'       },
  1170: { k: 'b5',  full: 'b5Mg'         },
  1176: { k: 'b7',  full: 'biotinMcg'    },
  1180: { k: 'cl',  full: 'cholineMg'    },
  // Lipid breakdown
  1258: { k: 'sf',  full: 'satFatG'      },
  1257: { k: 'tf',  full: 'transFatG'    },
  1292: { k: 'mf',  full: 'monoFatG'     },
  1293: { k: 'pf',  full: 'polyFatG'     },
  1253: { k: 'ch',  full: 'cholesterolMg'},
  // More minerals
  1091: { k: 'ph',  full: 'phosphorusMg' },
  1101: { k: 'mn',  full: 'manganeseMg'  },
  // General
  1051: { k: 'wa',  full: 'waterG'       },
  1057: { k: 'cf',  full: 'caffeineMg'   },
  1018: { k: 'al',  full: 'alcoholG'     },
  1009: { k: 'st',  full: 'starchG'      },
  1235: { k: 'asg', full: 'addedSugarG'  },
  // Amino acids (g) — the 11 shown in the nutrient detail panel
  1210: { k: 'trp', full: 'tryptophanG'    },
  1211: { k: 'thr', full: 'threonineG'     },
  1212: { k: 'ile', full: 'isoleucineG'    },
  1213: { k: 'leu', full: 'leucineG'       },
  1214: { k: 'lys', full: 'lysineG'        },
  1215: { k: 'met', full: 'methionineG'    },
  1216: { k: 'cys', full: 'cystineG'       },
  1217: { k: 'phe', full: 'phenylalanineG' },
  1218: { k: 'tyr', full: 'tyrosineG'      },
  1219: { k: 'val', full: 'valineG'        },
  1221: { k: 'his', full: 'histidineG'     },
  // Omega fatty-acid components are read directly by id in processFood():
  //   omega-3: ALA 1404, EPA 1278, DHA 1272   (NOTE: the old ids 1409/1408 were
  //   wrong — 1409 is an 18:3 isomer, not EPA — so w3 was undercounted before)
  //   omega-6: LA 1316 (fallback 1269 undifferentiated 18:2), AA 1271, GLA 1321
};

// ── USDA food category → our 9 categories ────────────────────────────────────
const CAT = {
  'Poultry Products':                    'protein',
  'Beef Products':                       'protein',
  'Pork Products':                       'protein',
  'Finfish and Shellfish Products':      'protein',
  'Lamb, Veal, and Game Products':       'protein',
  'Sausages and Luncheon Meats':         'protein',
  'Legumes and Legume Products':         'protein',
  'Dairy and Egg Products':              'dairy',
  'Cereal Grains and Pasta':             'grain',
  'Baked Products':                      'grain',
  'Breakfast Cereals':                   'grain',
  'Vegetables and Vegetable Products':   'vegetable',
  'Fruits and Fruit Juices':             'fruit',
  'Nut and Seed Products':               'fat',
  'Fats and Oils':                       'fat',
  'Beverages':                           'beverage',
  'Restaurant Foods':                    'other',
  'Fast Foods':                          'other',
  'Snacks':                              'other',
  'Sweets':                              'other',
  'Soups, Sauces, and Gravies':          'other',
  'Meals, Entrees, and Side Dishes':     'other',
  'Baby Foods':                          'other',
  'Spices and Herbs':                    'other',
  'American Indian/Alaska Native Foods': 'other',
};

// ── Datasets to download ──────────────────────────────────────────────────────
const DATASETS = [
  {
    name:      'USDA SR Legacy',
    // Try both known URL patterns (USDA occasionally moves files)
    url:       'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2021-10-28.zip',
    urlFallback:'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
    cache:     'sr_legacy.zip',
    arrayKey:  'SRLegacyFoods',
    catField:  f => f.foodCategory?.description,
    srcLabel:  'USDA SR28',
  },
  {
    name:      'USDA Foundation Foods (2024)',
    url:       'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2024-10-31.zip',
    cache:     'foundation.zip',
    arrayKey:  'FoundationFoods',
    catField:  f => f.foodCategory?.description,
    srcLabel:  'USDA FND',
  },
  {
    name:      'USDA Survey/FNDDS (2022)',
    url:       'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2022-10-28.zip',
    cache:     'survey.zip',
    arrayKey:  'SurveyFoods',
    // FNDDS uses a different category system; fall back to 'other' mostly
    catField:  f => {
      const desc = f.wweiaFoodCategory?.wweiaFoodCategoryDescription || '';
      if (/chicken|turkey|beef|pork|fish|shrimp|egg|bean|tofu/i.test(desc)) return 'Poultry Products';
      if (/milk|cheese|yogurt|dairy/i.test(desc)) return 'Dairy and Egg Products';
      if (/bread|rice|pasta|cereal|grain/i.test(desc)) return 'Cereal Grains and Pasta';
      if (/vegetable|salad|potato|tomato/i.test(desc)) return 'Vegetables and Vegetable Products';
      if (/fruit|juice|berry/i.test(desc)) return 'Fruits and Fruit Juices';
      if (/oil|butter|nut|seed/i.test(desc)) return 'Fats and Oils';
      if (/coffee|tea|soda|water|drink/i.test(desc)) return 'Beverages';
      return null;
    },
    srcLabel:  'USDA FNDDS',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': 'NutriCore-DB-Builder/1.0' } }, res => {
      // Follow redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(() => fs.unlinkSync(dest));
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let downloaded = 0;
      const total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', chunk => {
        downloaded += chunk.length;
        if (total) {
          const pct = Math.round(downloaded / total * 100);
          process.stdout.write(`\r  ${pct}% (${(downloaded/1e6).toFixed(1)} MB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => { process.stdout.write('\n'); file.close(resolve); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

function extractJson(zipPath) {
  console.log(`  Extracting ${path.basename(zipPath)}…`);
  const zip     = new AdmZip(zipPath);
  const entries = zip.getEntries().filter(e => e.entryName.endsWith('.json'));
  if (!entries.length) throw new Error('No JSON found in ZIP');
  // The main JSON file is usually the largest entry
  entries.sort((a, b) => b.getData().length - a.getData().length);
  return JSON.parse(entries[0].getData().toString('utf8'));
}

function round(n, d = 2) {
  if (!n || isNaN(n)) return 0;
  return +parseFloat(n).toFixed(d);
}

// Parse a leading quantity off a portion description ("1 cup" → [1, 'cup'],
// "1/2 cup" → [0.5, 'cup']) so stored portions are always per-1-unit.
function splitQty(desc) {
  const m = /^([\d.]+(?:\/\d+)?)\s+(.+)$/.exec(desc.trim());
  if (!m) return [1, desc.trim()];
  let qty;
  if (m[1].includes('/')) {
    const [a, b] = m[1].split('/');
    qty = parseFloat(a) / parseFloat(b);
  } else {
    qty = parseFloat(m[1]);
  }
  return qty > 0 ? [qty, m[2]] : [1, desc.trim()];
}

// Extract up to 4 named per-1-unit portions ("cup" → 240 g) for the serving picker.
function extractPortions(food) {
  const out = [];
  const seen = new Set();
  for (const p of food.foodPortions || []) {
    if (!p.gramWeight || p.gramWeight <= 0) continue;
    let name, qty = 1;
    if (p.portionDescription && !/not specified/i.test(p.portionDescription)) {
      [qty, name] = splitQty(p.portionDescription);
    } else if (p.measureUnit?.name && p.measureUnit.name !== 'undetermined') {
      name = p.measureUnit.name + (p.modifier ? ` ${p.modifier}` : '');
      qty = p.amount ?? p.value ?? 1;
    } else if (p.modifier) {
      name = p.modifier;
      qty = p.amount ?? p.value ?? 1;
    } else {
      continue;
    }
    name = name.trim().toLowerCase();
    // Skip grams (redundant), FNDDS numeric portion codes ("90000"), and junk.
    if (!name || name === 'g' || name === 'gram' || /^\d+$/.test(name) || seen.has(name) || name.length > 40) continue;
    seen.add(name);
    out.push([name, round(p.gramWeight / (qty || 1), 1)]);
    if (out.length >= 4) break;
  }
  return out;
}

function processFood(food, dataset) {
  const fdcId = food.fdcId;
  if (!fdcId) return null;

  // Extract nutrients
  const vals = {};
  for (const fn of (food.foodNutrients || [])) {
    const nid = fn.nutrient?.id || fn.nutrientId;
    const amt = fn.amount ?? fn.value;
    if (nid && amt != null) vals[nid] = amt;
  }

  // Omega components. Old ids (1409/1408) were wrong — EPA is 1278, DHA 1272.
  const ala = vals[1404] || 0, epa = vals[1278] || 0, dha = vals[1272] || 0;
  const la  = (vals[1316] ?? vals[1269]) || 0, aa = vals[1271] || 0, gla = vals[1321] || 0;
  const omega3 = round(ala + epa + dha, 3);
  const omega6 = round(la + aa + gla, 3);

  const catDesc = dataset.catField(food);
  const cat     = CAT[catDesc] || 'other';

  // Serving size (default 100g)
  let srv = 100;
  const portions = food.foodPortions || [];
  if (portions.length) {
    const gram = portions.find(p => p.measureUnit?.name === 'g' || p.measureUnit?.abbreviation === 'g');
    if (gram?.gramWeight) srv = round(gram.gramWeight, 0);
    else if (portions[0]?.gramWeight) srv = round(portions[0].gramWeight, 0);
  }

  const compact = {
    i:   fdcId,
    n:   food.description,
    c:   cat,
    src: dataset.srcLabel,
    srv: srv || 100,
    k:   round(vals[1008] || vals[2047] || vals[2048] ||
              ((vals[1003] || 0) * 4 + (vals[1005] || 0) * 4 + (vals[1004] || 0) * 9), 0),
    p:   round(vals[1003]),
    cb:  round(vals[1005]),
    f:   round(vals[1004]),
  };

  // Everything beyond the core macros is emitted only when non-zero — the
  // downloader's expand() defaults missing keys to 0, and skipping zeros keeps
  // the JSON payload roughly half the size it would otherwise be.
  const put = (key, val, dec = 2) => {
    const r = round(val, dec);
    if (r) compact[key] = r;
  };

  put('fi',  vals[1079]);
  put('sg',  vals[2000] ?? vals[1063]);
  put('asg', vals[1235]);
  put('st',  vals[1009]);
  put('na',  vals[1093], 0);
  put('ca',  vals[1087], 0);
  put('fe',  vals[1089]);
  put('mg',  vals[1090], 0);
  put('kp',  vals[1092], 0);
  put('ph',  vals[1091], 0);
  put('zn',  vals[1095]);
  put('cu',  vals[1098], 3);
  put('mn',  vals[1101], 3);
  put('se',  vals[1103]);
  put('va',  vals[1106], 0);
  put('vc',  vals[1162]);
  put('vd',  vals[1114]);
  put('ve',  vals[1109]);
  put('vk',  vals[1185]);
  put('b1',  vals[1165], 3);
  put('b2',  vals[1166], 3);
  put('b3',  vals[1167]);
  put('b5',  vals[1170], 3);
  put('b6',  vals[1175], 3);
  put('b7',  vals[1176]);
  put('fo',  vals[1177], 0);
  put('b12', vals[1178], 3);
  put('cl',  vals[1180], 0);
  put('sf',  vals[1258], 3);
  put('tf',  vals[1257], 3);
  put('mf',  vals[1292], 3);
  put('pf',  vals[1293], 3);
  put('ch',  vals[1253], 0);
  put('wa',  vals[1051], 0);
  put('cf',  vals[1057], 0);
  put('al',  vals[1018]);
  put('w3',  omega3, 3);
  put('w6',  omega6, 3);
  put('ala', ala, 3);
  put('epa', epa, 3);
  put('dha', dha, 3);
  put('la',  la, 3);
  put('aa',  aa, 3);
  // Amino acids
  put('trp', vals[1210], 3);
  put('thr', vals[1211], 3);
  put('ile', vals[1212], 3);
  put('leu', vals[1213], 3);
  put('lys', vals[1214], 3);
  put('met', vals[1215], 3);
  put('cys', vals[1216], 3);
  put('phe', vals[1217], 3);
  put('tyr', vals[1218], 3);
  put('val', vals[1219], 3);
  put('his', vals[1221], 3);

  // Named portions for the serving picker ("cup" → 240 g)
  const pt = extractPortions(food);
  if (pt.length) compact.pt = pt;

  // Skip foods with no calorie data
  if (!compact.k && !compact.p && !compact.cb && !compact.f) return null;

  return compact;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🥦 NutriCore Food Database Builder\n');
  const allFoods = [];
  const seen     = new Set(); // deduplicate by fdcId

  for (const dataset of DATASETS) {
    console.log(`\n📥 ${dataset.name}`);
    const cachePath = path.join(CACHE_DIR, dataset.cache);

    // Download (skip if cached)
    if (fs.existsSync(cachePath)) {
      console.log(`  Using cached file (${(fs.statSync(cachePath).size / 1e6).toFixed(1)} MB)`);
    } else {
      console.log(`  Downloading from USDA… (this may take a minute)`);
      const urls = [dataset.url, dataset.urlFallback].filter(Boolean);
      let ok = false;
      for (const url of urls) {
        try {
          await download(url, cachePath);
          ok = true;
          break;
        } catch (err) {
          if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
          console.log(`  ⚠️  ${err.message} — trying fallback…`);
        }
      }
      if (!ok) {
        console.error(`  ⚠️  All URLs failed — skipping ${dataset.name}.`);
        continue;
      }
    }

    // Parse
    let data;
    try {
      data = extractJson(cachePath);
    } catch (err) {
      console.error(`  ⚠️  Parse failed: ${err.message}`);
      continue;
    }

    const foods = data[dataset.arrayKey] || [];
    console.log(`  Processing ${foods.length.toLocaleString()} foods…`);

    let added = 0;
    for (const food of foods) {
      if (seen.has(food.fdcId)) continue;
      const compact = processFood(food, dataset);
      if (compact) {
        allFoods.push(compact);
        seen.add(food.fdcId);
        added++;
      }
    }
    console.log(`  ✓ Added ${added.toLocaleString()} foods`);
  }

  // Sort by name for predictable ordering
  allFoods.sort((a, b) => a.n.localeCompare(b.n));

  // Write output
  const json    = JSON.stringify(allFoods);
  const sizeMB  = (json.length / 1e6).toFixed(2);
  fs.writeFileSync(OUT_FILE, json, 'utf8');

  console.log(`\n✅ Done!`);
  console.log(`   Foods: ${allFoods.length.toLocaleString()}`);
  console.log(`   Output: public/foods-db.json (${sizeMB} MB raw)`);
  console.log(`   Gzipped estimate: ~${(json.length / 1e6 / 3).toFixed(2)} MB (what users download)`);
  console.log(`\n   Next: commit public/foods-db.json and run npm run deploy\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
