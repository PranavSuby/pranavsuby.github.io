import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initNutriCore, getProfile, saveProfile } from './db';

// Single source of truth for NutriCore's shared client state, mirroring the gym
// app's AppContext. Owns:
//  - `profile`   — the one profile singleton, read by most screens.
//  - `dataVersion` — a counter bumped after any diary/water/biometric write so
//    screens that show aggregates (Data, Trends) can re-fetch even while mounted
//    underneath an overlay. Subscribe by listing `dataVersion` in a load effect.
const NCContext = createContext(null);

export function NCProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

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
    }}>
      {children}
    </NCContext.Provider>
  );
}

export function useNutriCore() {
  return useContext(NCContext);
}
