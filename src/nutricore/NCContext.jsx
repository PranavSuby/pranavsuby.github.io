import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initNutriCore, getProfile, saveProfile, getDefaultGoals, saveDefaultGoals } from './db';
import { getAdaptiveExpenditure, weekKey } from './adaptive';
import { computeTargetsFromTdee } from './tdee';

// Single source of truth for NutriCore's shared client state, mirroring the gym
// app's AppContext. Owns:
//  - `profile`   — the one profile singleton, read by most screens.
//  - `dataVersion` — a counter bumped after any diary/water/biometric write so
//    screens that show aggregates (Data, Trends) can re-fetch even while mounted
//    underneath an overlay. Subscribe by listing `dataVersion` in a load effect.
//  - `adaptive` — the adaptive-expenditure snapshot (see adaptive.js), recomputed
//    after every data change. Also runs the once-a-week coaching pass that refits
//    default calorie/macro targets to the observed expenditure.
const NCContext = createContext(null);

export function NCProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [adaptive, setAdaptive] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await initNutriCore();
        setProfile(await getProfile());
        setReady(true);
      } catch (err) {
        console.error('NutriCore init failed:', err);
        setInitError(err?.message || 'Startup failed');
        setReady(true);
      }
    })();
  }, []);

  // Signal that shared data changed so other mounted screens re-fetch.
  const bumpData = useCallback(() => setDataVersion(v => v + 1), []);

  // Weekly coaching: at most once per calendar week (Monday-keyed), refit the
  // default targets to the adaptive expenditure. Skipped in manual mode or while
  // adaptive doesn't yet have enough data — sparse-data users keep whatever
  // targets they set themselves. Returns the updated profile, or null if no
  // check-in ran.
  const runCoaching = useCallback(async (prof, adap) => {
    if ((prof.coachingMode || 'adaptive') === 'manual' || !adap?.available) return null;
    const wk = weekKey();
    if (prof.lastCoachedWeek === wk) return null;
    const targets = computeTargetsFromTdee(prof, adap.tdee);
    const prev = await getDefaultGoals();
    await saveDefaultGoals(targets);
    const entry = {
      week: wk,
      tdee: adap.tdee,
      kcal: targets.kcal,
      deltaKcal: targets.kcal - (prev?.kcal ?? targets.kcal),
    };
    const next = {
      ...prof,
      lastCoachedWeek: wk,
      coachHistory: [...(prof.coachHistory || []).slice(-11), entry],
    };
    await saveProfile(next);
    return next;
  }, []);

  // Recompute adaptive expenditure whenever data changes, then run the weekly
  // check-in. Coaching writes the profile, which re-runs this effect; the
  // lastCoachedWeek guard makes the second pass a no-op, so it converges.
  useEffect(() => {
    if (!ready || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const adap = await getAdaptiveExpenditure(profile);
        if (cancelled) return;
        setAdaptive(adap);
        const coached = await runCoaching(profile, adap);
        if (coached && !cancelled) {
          setProfile(coached);
          setDataVersion(v => v + 1); // goals changed — aggregate screens re-fetch
        }
      } catch (err) {
        console.error('Adaptive expenditure update failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, profile, dataVersion, runCoaching]);

  const refreshProfile = useCallback(async () => {
    setProfile(await getProfile());
    bumpData();
  }, [bumpData]);

  // Optimistically update local profile, then persist. Bumping dataVersion lets
  // aggregate screens (Trends/Data) pick up unit/goal changes, not just diary edits.
  const updateProfile = useCallback(async (next) => {
    setProfile(next);
    await saveProfile(next);
    bumpData();
  }, [bumpData]);

  return (
    <NCContext.Provider value={{
      profile, ready, initError,
      refreshProfile, updateProfile,
      dataVersion, bumpData,
      adaptive,
    }}>
      {children}
    </NCContext.Provider>
  );
}

export function useNutriCore() {
  return useContext(NCContext);
}
