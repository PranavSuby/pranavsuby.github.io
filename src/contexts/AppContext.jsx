import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, getAllCustomExercises, getAllRoutines, getAllSessions } from '../db';

const AppContext = createContext(null);

const DEFAULTS = { key: 'main', units: 'kg', defaultRest: 90, keepAwake: true, rpeEnabled: false };

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [customExercises, setCustomExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getSettings().then(s => setSettings({ ...DEFAULTS, ...s })),
      getAllCustomExercises().then(setCustomExercises),
      getAllRoutines().then(r => setRoutines(r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))),
      getAllSessions().then(setSessions),
    ]).finally(() => setDataReady(true));
  }, []);

  const updateSetting = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
  };

  const refreshExercises = useCallback(() => {
    getAllCustomExercises().then(setCustomExercises);
  }, []);

  const refreshRoutines = useCallback(() => {
    getAllRoutines().then(r => setRoutines(r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))));
  }, []);

  const refreshSessions = useCallback(() => {
    getAllSessions().then(setSessions);
  }, []);

  return (
    <AppContext.Provider value={{
      settings, updateSetting,
      customExercises, refreshExercises,
      routines, refreshRoutines,
      sessions, refreshSessions,
      dataReady,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
