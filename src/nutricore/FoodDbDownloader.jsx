import { useState, useEffect } from 'react';
import { getDB, prepFood } from './db';

// Increment this when foods-db.json changes to force a re-download
const FOOD_DB_VERSION = '3';
const FOOD_DB_URL     = '/foods-db.json';
const LS_KEY          = 'nc_food_db_v';

// Expand compact format → full IndexedDB food object
function expand(f) {
  return {
    id:           f.i,
    name:         f.n,
    brand:        f.br || null,
    category:     f.c,
    sourceDb:     f.src,
    servingSizeG: f.srv || 100,
    isCustom:     false,
    kcal:         f.k   || 0,
    proteinG:     f.p   || 0,
    carbsG:       f.cb  || 0,
    fatG:         f.f   || 0,
    fiberG:       f.fi  || 0,
    sugarG:       f.sg  || 0,
    sodiumMg:     f.na  || 0,
    calciumMg:    f.ca  || 0,
    ironMg:       f.fe  || 0,
    magnesiumMg:  f.mg  || 0,
    potassiumMg:  f.kp  || 0,
    zincMg:       f.zn  || 0,
    copperMg:     f.cu  || 0,
    seleniumMcg:  f.se  || 0,
    vitaminAMcg:  f.va  || 0,
    vitaminCMg:   f.vc  || 0,
    vitaminDMcg:  f.vd  || 0,
    vitaminEMg:   f.ve  || 0,
    vitaminKMcg:  f.vk  || 0,
    thiamineMg:   f.b1  || 0,
    riboflavinMg: f.b2  || 0,
    niacinMg:     f.b3  || 0,
    b6Mg:         f.b6  || 0,
    folateMcg:    f.fo  || 0,
    b12Mcg:       f.b12 || 0,
    b5Mg:         f.b5  || 0,
    biotinMcg:    f.b7  || 0,
    cholineMg:    f.cl  || 0,
    satFatG:      f.sf  || 0,
    transFatG:    f.tf  || 0,
    monoFatG:     f.mf  || 0,
    polyFatG:     f.pf  || 0,
    cholesterolMg: f.ch || 0,
    phosphorusMg: f.ph  || 0,
    manganeseMg:  f.mn  || 0,
    waterG:       f.wa  || 0,
    caffeineMg:   f.cf  || 0,
    alcoholG:     f.al  || 0,
    starchG:      f.st  || 0,
    addedSugarG:  f.asg || 0,
    omega3G:      f.w3  || 0,
    omega6G:      f.w6  || 0,
    omega3AlaG:   f.ala || 0,
    omega3EpaG:   f.epa || 0,
    omega3DhaG:   f.dha || 0,
    omega6LaG:    f.la  || 0,
    omega6AaG:    f.aa  || 0,
    tryptophanG:  f.trp || 0,
    threonineG:   f.thr || 0,
    isoleucineG:  f.ile || 0,
    leucineG:     f.leu || 0,
    lysineG:      f.lys || 0,
    methionineG:  f.met || 0,
    cystineG:     f.cys || 0,
    phenylalanineG: f.phe || 0,
    tyrosineG:    f.tyr || 0,
    valineG:      f.val || 0,
    histidineG:   f.his || 0,
    // Named portions ("cup" → 240 g) → the serving picker's servingSizes
    servingSizes: f.pt ? f.pt.map(([name, grams]) => ({ name, grams })) : null,
  };
}

export function isFoodDbReady() {
  return localStorage.getItem(LS_KEY) === FOOD_DB_VERSION;
}

// The localStorage flag can outlive the data: iOS Safari evicts IndexedDB under
// storage pressure without touching localStorage. Verify rows actually exist before
// trusting the flag, otherwise search is silently reduced to seed foods forever.
async function foodDbLooksPresent() {
  try {
    const db = await getDB();
    return (await db.count('nc_foods')) > 500;
  } catch {
    return true; // can't verify — don't force a pointless re-download
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FoodDbDownloader({ onDone }) {
  const [phase,    setPhase]    = useState('checking');
  const [progress, setProgress] = useState(0);
  const [count,    setCount]    = useState(0);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isFoodDbReady() && await foodDbLooksPresent()) { onDone(); return; }
      if (!cancelled) run();
    })();
    return () => { cancelled = true; };
  }, []); // intentional: run once on mount

  async function run() {
    try {
      // ── 1. Fetch the JSON file ──────────────────────────────────────────────
      // The version param busts the service worker's stale-while-revalidate cache;
      // without it a FOOD_DB_VERSION bump silently re-imports the OLD cached JSON.
      setPhase('downloading');
      const res = await fetch(`${FOOD_DB_URL}?v=${FOOD_DB_VERSION}`, { cache: 'no-cache' });
      if (!res.ok) {
        if (res.status === 404) {
          // File not built yet — skip silently, app still works with seed foods
          console.warn('foods-db.json not found — run npm run build:foods to generate it');
          onDone();
          return;
        }
        throw new Error(`Server returned ${res.status}`);
      }

      // ── 2. Parse ───────────────────────────────────────────────────────────
      setPhase('parsing');
      const foods = await res.json();
      const total = foods.length;
      setCount(total);

      // ── 3. Write to IndexedDB in batches ───────────────────────────────────
      setPhase('writing');
      const db = await getDB();
      const BATCH = 300;

      // User-created foods live in the same store with autoIncrement ids. If any of
      // them landed inside the bundled id range (possible on installs that created
      // customs before/without the download), a blind put would REPLACE them —
      // destroying user data and repointing their favorites/diary references. The
      // user's food wins; the colliding bundled row is skipped.
      const existing = await db.getAll('nc_foods');
      const protectedIds = new Set(
        existing.filter(f => f.isCustom || f.sourceDb === 'custom' || f.scanned).map(f => f.id)
      );

      let maxBundledId = 0;
      for (let i = 0; i < total; i += BATCH) {
        const batch = foods.slice(i, i + BATCH);
        const tx = db.transaction('nc_foods', 'readwrite');
        batch.forEach(f => {
          if (f.i > maxBundledId) maxBundledId = f.i;
          if (!protectedIds.has(f.i)) tx.store.put(prepFood(expand(f)));
        });
        await tx.done;
        setProgress(Math.round((i + batch.length) / total * 100));
      }

      // Push the store's autoIncrement counter well past the bundled id range so
      // foods created from now on can never collide with a future re-download
      // (writing then deleting a high explicit key advances the key generator).
      try {
        const guardId = maxBundledId + 1_000_000;
        const cur = await db.count('nc_foods', IDBKeyRange.lowerBound(guardId));
        if (cur === 0) {
          await db.put('nc_foods', prepFood({ id: guardId, name: '__id_guard__' }));
          await db.delete('nc_foods', guardId);
        }
      } catch {}

      // ── 4. Mark done ───────────────────────────────────────────────────────
      localStorage.setItem(LS_KEY, FOOD_DB_VERSION);
      setPhase('done');
      onDone();
    } catch (err) {
      console.error('Food DB download failed:', err);
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div className="nc-app" style={overlay}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: 'var(--nc-warn)', marginBottom: 8 }}>Database download failed</div>
        <div style={{ fontSize: 12, color: 'var(--nc-text3)', marginBottom: 20, textAlign: 'center' }}>{error}</div>
        <button className="nc-save-btn" style={{ width: 'auto', padding: '10px 24px', marginBottom: 10 }}
          onClick={() => { setError(null); setPhase('checking'); run(); }}>Retry download</button>
        <button style={{ padding: '10px 24px', color: 'var(--nc-text2)', fontSize: 14 }}
          onClick={onDone}>Continue with seed foods</button>
      </div>
    );
  }

  const label = {
    checking:    'Checking database…',
    downloading: 'Downloading food database…',
    parsing:     'Reading data…',
    writing:     `Loading into database… ${progress}%`,
    done:        'Done!',
  }[phase] || '';

  return (
    <div className="nc-app" style={overlay}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🥦</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nc-text)', marginBottom: 6 }}>
        Building Food Database
      </div>
      <div style={{ fontSize: 13, color: 'var(--nc-text2)', marginBottom: 20, textAlign: 'center' }}>
        {count > 0
          ? `${count.toLocaleString()} foods with full nutrition data`
          : 'One-time download · fully offline after this'}
      </div>
      <div style={{ width: 220, height: 6, background: 'var(--nc-neutral)', borderRadius: 3, marginBottom: 12 }}>
        <div style={{
          height: '100%', borderRadius: 3, background: 'var(--nc-accent)',
          width: phase === 'writing' ? `${progress}%` : phase === 'done' ? '100%' : '0%',
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--nc-text3)' }}>{label}</div>
    </div>
  );
}

const overlay = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  background: 'var(--nc-bg)',
};
