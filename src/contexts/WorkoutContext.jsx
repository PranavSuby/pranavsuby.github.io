import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  saveSession,
  getLastSetsForExercise,
  getAllRoutines,
  saveRoutine,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
  saveLastWorkoutSettings,
  getLastWorkoutSettings,
  getAllSessions,
} from '../db';
import { calc1RM } from '../utils/stats';
import { alertTimerDone, ensureNotifyPermission, scheduleRestNotification, cancelRestNotification, primeAudio } from '../utils/alerts';
import { estimateCalories } from '../utils/gymCalories';
import { getBodyWeightKg } from '../utils/biometrics';
import { genId } from '../utils/id';
import { useApp } from './AppContext';

const WorkoutContext = createContext(null);

const DEFAULT_SET = {
  type: 'N',
  weight: '',
  reps: '',
  time: '',
  rpe: null,
  rir: null,
  completed: false,
  previous: null,
};

function makeDefaultSet(prev = null) {
  return { ...DEFAULT_SET, previous: prev };
}

// Convert an exercise's entered/ghost weights when its unit changes, so "100 kg"
// becomes "220.5 lbs" instead of silently re-labelling the same number.
const KG_PER_LB = 1 / 2.20462;
function convertWeight(value, from, to) {
  if (from === to) return value;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return value;
  const converted = to === 'lbs' ? n / KG_PER_LB : n * KG_PER_LB;
  return String(Math.round(converted * 10) / 10);
}
function convertExerciseUnits(ex, units) {
  const from = ex.units ?? 'kg';
  if (from === units) return ex;
  return {
    ...ex,
    units,
    sets: (ex.sets || []).map(s => ({
      ...s,
      weight: convertWeight(s.weight, from, units),
      previous: s.previous
        ? { ...s.previous, weight: convertWeight(s.previous.weight, from, units) }
        : s.previous,
    })),
  };
}

// Build a set's "previous" ghost from history, converting the stored weight from the
// unit it was logged in to the live exercise's unit. Without this, 225 logged in lbs
// ghosts as "225" under a KG header — poisoning autofill, saved data, and PR detection.
function makePrevious(history, i, targetUnits) {
  const s = history.sets[i];
  if (!s) return null;
  return {
    weight: convertWeight(s.weight ?? '', history.units ?? 'kg', targetUnits ?? 'kg'),
    reps: s.reps ?? '',
    time: s.time ?? '',
  };
}

function deepCloneExercises(exercises) {
  return exercises.map(ex => ({
    ...ex,
    supersetGroupId: ex.supersetGroupId ?? null,
    note: ex.note ?? '',
    restTime: ex.restTime ?? null,
    collapsed: false,
    imageUrl: ex.imageUrl ?? null,
    // Leave null when the routine didn't pin a unit so startSession can fall back to the
    // user's global unit (forcing 'kg' here made every routine ignore an lbs setting).
    units: ex.units ?? null,
    sets: (ex.sets || [{ ...DEFAULT_SET }]).map(s => ({
      ...DEFAULT_SET,
      ...s,
      completed: false,
      previous: null,
    })),
  }));
}

export function WorkoutProvider({ children }) {
  const { refreshSessions, refreshRoutines } = useApp();
  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [prBanner, setPrBanner] = useState(null);
  const [prs, setPrs] = useState([]);
  const [workoutSettings, setWorkoutSettingsState] = useState({ defaultRestTime: null, intensityMode: 'none' });
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs for timers and current settings
  const elapsedIntervalRef = useRef(null);
  const restTimeoutRef = useRef(null);
  const prBannerTimeoutRef = useRef(null);
  const workoutSettingsRef = useRef({ defaultRestTime: null, intensityMode: 'none' });
  // Mirror of `session` for handlers that must read the latest value without being
  // recreated per keystroke, and for the persistence flush below.
  const sessionRef = useRef(null);
  // Pending debounced saveActiveSession timer — held in a ref so finish/cancel can
  // cancel it BEFORE deleting the persisted row (the effect cleanup alone runs a
  // React commit too late, letting a due timer resurrect a finished workout).
  const saveTimerRef = useRef(null);
  // All-time best per exercise name, seeded from history then kept monotonic as sets
  // complete. Used so PR detection compares against real records, not just this session.
  const bestSeenRef = useRef({});

  // Seed all-time bests for the given exercise names from saved sessions, then fold in
  // any already-completed sets of the supplied in-progress exercises (restore case).
  // Bests are stored in kg so kg and lbs history compare on the same scale.
  const foldSetIntoBests = useCallback((name, set, units) => {
    const w = +set.weight || 0, r = +set.reps || 0;
    if (w <= 0) return;
    const wKg = units === 'lbs' ? w * KG_PER_LB : w;
    const b = bestSeenRef.current[name] || { weight: 0, e1rm: 0, reps: 0 };
    bestSeenRef.current[name] = {
      weight: Math.max(b.weight, wKg),
      e1rm:   Math.max(b.e1rm, calc1RM(wKg, r)),
      reps:   Math.max(b.reps, r),
    };
  }, []);

  const seedHistoricalBests = useCallback(async (names, liveExercises) => {
    try {
      const all = await getAllSessions();
      const wanted = new Set([...names].filter(Boolean));
      for (const s of all) {
        for (const ex of s.exercises || []) {
          if (!wanted.has(ex.name)) continue;
          for (const set of ex.sets || []) {
            if (set.completed) foldSetIntoBests(ex.name, set, ex.units ?? 'kg');
          }
        }
      }
    } catch {}
    for (const ex of liveExercises || []) {
      for (const s of ex.sets || []) {
        if (s.completed) foldSetIntoBests(ex.name, s, ex.units ?? 'kg');
      }
    }
  }, [foldSetIntoBests]);

  // Keep workoutSettingsRef in sync with state
  useEffect(() => { workoutSettingsRef.current = workoutSettings; }, [workoutSettings]);

  // ── Restore active session on mount ─────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      try {
        const [saved, ws] = await Promise.all([getActiveSession(), getLastWorkoutSettings()]);
        if (saved) {
          setSession(saved);
          setWorkoutSettingsState(ws);
          // Await so a set checked off right after a refresh can't race an empty
          // baseline and fire a false PR banner (same as startSession/addExercise).
          await seedHistoricalBests((saved.exercises || []).map(e => e.name), saved.exercises);
        }
      } catch {}
    }
    restore();
  }, []); 
  // ── Persist active session to DB (debounced) ─────────────────────────────────
  useEffect(() => {
    sessionRef.current = session;
    if (!session) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveActiveSession(session);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [session]);

  // Flush the pending save when the app is backgrounded or the page is going away —
  // otherwise edits made in the last 500 ms are lost if the tab is evicted (common on
  // mobile right after typing a weight and switching apps).
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current && sessionRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        saveActiveSession(sessionRef.current);
      }
    };
    const onVis = () => { if (document.hidden) flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // ── Persist workoutSettings when they change during a session ───────────────
  useEffect(() => {
    if (!session) return;
    saveLastWorkoutSettings(workoutSettings);
  }, [workoutSettings]); 
  // ── Elapsed timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (session) {
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
      }, 1000);
    } else {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
      setElapsed(0);
    }
    return () => clearInterval(elapsedIntervalRef.current);
  }, [session?.id]); // only restart when a new session begins

  // ── Rest timer countdown ─────────────────────────────────────────────────────
  // Driven off an absolute `endsAt` timestamp rather than decrementing a counter, so
  // it stays accurate even when the tab is backgrounded and timers are throttled. A
  // visibilitychange listener re-syncs the displayed value the moment we return.
  useEffect(() => {
    clearInterval(restTimeoutRef.current);
    if (!restTimer || !restTimer.endsAt) { cancelRestNotification(); return; }

    const TITLE = 'Rest complete', BODY = 'Time for your next set 💪';

    function tick() {
      const remaining = Math.round((restTimer.endsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(restTimeoutRef.current);
        alertTimerDone(TITLE, BODY);
        setRestTimer(null);
      } else {
        setRestTimer(prev => (prev && prev.remaining !== remaining ? { ...prev, remaining } : prev));
      }
    }

    restTimeoutRef.current = setInterval(tick, 250);

    // iOS freezes page timers when the PWA is backgrounded, so the foreground countdown
    // never reaches 0 while you're away. When we lose visibility, hand the deadline to the
    // service worker (which can still fire a system notification); on return, cancel that
    // and re-sync the on-screen timer.
    const onVisible = () => {
      if (document.visibilityState === 'visible') { cancelRestNotification(); tick(); }
      else { scheduleRestNotification(restTimer.endsAt, TITLE, BODY); }
    };
    document.addEventListener('visibilitychange', onVisible);
    if (document.hidden) scheduleRestNotification(restTimer.endsAt, TITLE, BODY);
    tick();

    return () => {
      clearInterval(restTimeoutRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [restTimer?.endsAt]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function showPrBanner(exerciseName, type, value, unit = 'kg') {
    clearTimeout(prBannerTimeoutRef.current);
    setPrBanner({ exerciseName, type, value, unit });
    prBannerTimeoutRef.current = setTimeout(() => setPrBanner(null), 3000);
  }

  function clearSessionState() {
    setSession(null);
    setPrs([]);
    setRestTimer(null);
    setPrBanner(null);
    setElapsed(0);
    setWorkoutSettingsState({ defaultRestTime: null, intensityMode: 'none' });
    setIsMinimized(false);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  const startSession = useCallback(async (routine, settings) => {
    // Hard guard: never silently replace an in-progress workout (a minimized session
    // is easy to forget). Callers must finish/cancel first — WorkoutTab confirms with
    // the user and cancels explicitly.
    if (sessionRef.current) return false;
    ensureNotifyPermission(); // enable rest-timer alerts when backgrounded
    primeAudio();             // unlock WebAudio so the rest chime can play later
    // Load workout settings: routine.settings → last workout settings from DB
    let ws;
    if (routine?.settings) {
      ws = { defaultRestTime: null, intensityMode: 'none', ...routine.settings };
    } else {
      ws = await getLastWorkoutSettings();
    }
    setWorkoutSettingsState(ws);

    // Each exercise keeps its own unit if the routine pinned one, otherwise it inherits
    // the user's global unit.
    const globalUnits = settings?.units ?? 'kg';
    const exercises = deepCloneExercises(routine?.exercises || []).map(ex => ({
      ...ex,
      units: ex.units ?? globalUnits,
    }));

    // Load previous sets for each exercise (weights converted to the live unit)
    await Promise.all(
      exercises.map(async ex => {
        const history = await getLastSetsForExercise(ex.name);
        ex.sets = ex.sets.map((s, i) => ({ ...s, previous: makePrevious(history, i, ex.units) }));
      })
    );

    const newSession = {
      id: Date.now().toString(),
      routineId: routine?.id ?? null,
      title: routine?.title ?? 'Quick Workout',
      startedAt: Date.now(),
      date: new Date().toISOString(),
      exercises,
    };

    bestSeenRef.current = {};
    // Await so a set checked off immediately can't race an empty PR baseline and
    // fire a false PR banner.
    await seedHistoricalBests(exercises.map(e => e.name), null);

    setPrs([]);
    setSession(newSession);
    setElapsed(0);
  }, [seedHistoricalBests]);

  // Cancel any pending debounced save BEFORE deleting the persisted row, so a due
  // timer can't rewrite it and resurrect the workout on next launch.
  const cancelPendingSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  const cancelSession = useCallback(async () => {
    cancelPendingSave();
    await clearActiveSession();
    clearSessionState();
  }, [cancelPendingSave]);
  const finishSession = useCallback(async () => {
    if (!session) return null;
    const duration = Math.floor((Date.now() - session.startedAt) / 1000);
    let estimatedKcal = 0;
    try { estimatedKcal = estimateCalories(duration, await getBodyWeightKg()); } catch {}
    const finished = {
      ...session,
      finishedAt: Date.now(),
      duration,
      estimatedKcal,
    };
    await saveSession(finished);

    // Save settings as last workout settings
    await saveLastWorkoutSettings(workoutSettingsRef.current);

    // Persist settings back to routine if applicable — and refresh AppContext's copy,
    // otherwise the next start of this routine uses the stale in-memory settings.
    if (session.routineId) {
      try {
        const routines = await getAllRoutines();
        const r = routines.find(r => r.id === session.routineId);
        if (r) {
          await saveRoutine({ ...r, settings: workoutSettingsRef.current });
          refreshRoutines?.();
        }
      } catch {}
    }

    cancelPendingSave();
    await clearActiveSession();
    clearSessionState();
    refreshSessions();
    return finished;
  }, [session, refreshSessions, refreshRoutines, cancelPendingSave]);
  const setTitle = useCallback(title => {
    setSession(prev => prev ? { ...prev, title } : prev);
  }, []);

  const setWorkoutSettings = useCallback((key, value) => {
    setWorkoutSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const minimize = useCallback(() => setIsMinimized(true), []);
  const expand = useCallback(() => setIsMinimized(false), []);

  const updateSet = useCallback((exIdx, setIdx, field, value) => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIdx ? { ...s, [field]: value } : s
          ),
        };
      });
      return { ...prev, exercises };
    });
  }, []);

  // NOTE: all side effects (bestSeenRef mutation, PR banner, rest timer) happen HERE,
  // before dispatching — never inside the setSession updater. Updaters must stay pure:
  // React may discard and re-run them, and a surviving ref mutation with a dropped
  // state update would permanently suppress a real PR.
  const completeSet = useCallback((exIdx, setIdx, settings) => {
    primeAudio(); // checking a set is the gesture right before a rest starts
    const cur = sessionRef.current;
    if (!cur) return;
    const ex = cur.exercises[exIdx];
    const set = ex?.sets[setIdx];
    if (!set) return;

    const nowCompleting = !set.completed;

    // Ghost placeholders show last-session values; checking the set finalizes them
    // for any field the user left blank.
    const isEmpty = v => v === '' || v == null;
    const eff = nowCompleting
      ? {
          weight: isEmpty(set.weight) ? (set.previous?.weight ?? set.weight) : set.weight,
          reps:   isEmpty(set.reps)   ? (set.previous?.reps   ?? set.reps)   : set.reps,
          time:   isEmpty(set.time)   ? (set.previous?.time   ?? set.time)   : set.time,
        }
      : { weight: set.weight, reps: set.reps, time: set.time };

    // PR detection when completing — compares against the all-time baseline (seeded
    // from history) plus everything done so far this session. Detects a heaviest-ever
    // weight PR, otherwise a best estimated-1RM PR (which captures more reps at a
    // given weight). Bests are kept monotonic so each record only fires once.
    if (nowCompleting && +eff.weight > 0) {
      const exerciseName = ex.name;
      const w = +eff.weight;
      const r = +eff.reps || 0;
      // Compare in kg (the unit bestSeenRef stores) so kg and lbs history share one
      // scale, but display the PR value in the exercise's own unit.
      const wKg = (ex.units === 'lbs') ? w * KG_PER_LB : w;
      const e1rmKg = calc1RM(wKg, r);
      const best = bestSeenRef.current[exerciseName] || { weight: 0, e1rm: 0, reps: 0 };

      let prType = null;
      let prValue = null;
      if (wKg > best.weight) { prType = 'weight'; prValue = w; }
      else if (e1rmKg > best.e1rm + 0.001) { prType = '1rm'; prValue = Math.round(calc1RM(w, r)); }

      bestSeenRef.current[exerciseName] = {
        weight: Math.max(best.weight, wKg),
        e1rm:   Math.max(best.e1rm, e1rmKg),
        reps:   Math.max(best.reps, r),
      };

      if (prType) {
        setPrs(p => [...p, { exerciseName, weight: w, reps: r, type: prType, units: ex.units || 'kg' }]);
        showPrBanner(exerciseName, prType, prValue, ex.units || 'kg');
      }
    }

    // Start rest timer when completing — use workout-level default first
    if (nowCompleting) {
      const restSecs = ex.restTime
        ?? workoutSettingsRef.current.defaultRestTime
        ?? settings?.defaultRest
        ?? 90;
      if (restSecs > 0) {
        setRestTimer({ remaining: restSecs, total: restSecs, endsAt: Date.now() + restSecs * 1000 });
      }
    }

    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((e, ei) => {
        if (ei !== exIdx) return e;
        return {
          ...e,
          sets: e.sets.map((s, si) =>
            si === setIdx ? { ...s, ...(nowCompleting ? eff : {}), completed: nowCompleting } : s
          ),
        };
      });
      return { ...prev, exercises };
    });
  }, []);

  const cycleSetType = useCallback((exIdx, setIdx) => {
    const ORDER = ['N', 'W', 'D', 'F'];
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => {
            if (si !== setIdx) return s;
            const next = ORDER[(ORDER.indexOf(s.type) + 1) % ORDER.length];
            return { ...s, type: next };
          }),
        };
      });
      return { ...prev, exercises };
    });
  }, []);

  const addSet = useCallback(exIdx => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1] ?? DEFAULT_SET;
        // Carry weight/reps/time forward as a sensible default — but nothing else:
        // a new set is a fresh Normal set with no logged RPE/RIR, no completion, and
        // no "previous" reference (that belongs to the set it was copied from).
        const newSet = { ...makeDefaultSet(), weight: last.weight, reps: last.reps, time: last.time };
        return { ...ex, sets: [...ex.sets, newSet] };
      });
      return { ...prev, exercises };
    });
  }, []);

  const removeSet = useCallback((exIdx, setIdx) => {
    setSession(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      if (!ex || ex.sets.length <= 1) return prev;
      const exercises = prev.exercises.map((e, ei) => {
        if (ei !== exIdx) return e;
        return { ...e, sets: e.sets.filter((_, si) => si !== setIdx) };
      });
      return { ...prev, exercises };
    });
  }, []);

  const addExercise = useCallback(async (ex, settings) => {
    await seedHistoricalBests([ex.name], null);
    const history = await getLastSetsForExercise(ex.name);
    const units = settings?.units ?? 'kg';
    const firstSet = makeDefaultSet(makePrevious(history, 0, units));
    const newEx = {
      id: ex.id ?? Date.now().toString(),
      name: ex.name,
      bodyPart: ex.bodyPart ?? '',
      equipment: ex.equipment ?? '',
      trackingType: ex.trackingType ?? 'reps',
      imageUrl: ex.imageUrl ?? null,
      units,
      supersetGroupId: null,
      note: '',
      restTime: null,
      collapsed: false,
      sets: [firstSet],
    };
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, exercises: [...prev.exercises, newEx] };
    });
  }, [seedHistoricalBests]);

  const removeExercise = useCallback(exIdx => {
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.filter((_, ei) => ei !== exIdx),
      };
    });
  }, []);

  // Move an exercise up or down one slot. Supersets only render for *adjacent*
  // exercises, so after a move any group id no longer shared with a neighbour is
  // dropped rather than leaving phantom half-supersets behind.
  const moveExercise = useCallback((exIdx, direction) => {
    setSession(prev => {
      if (!prev) return prev;
      const to = exIdx + direction;
      if (to < 0 || to >= prev.exercises.length) return prev;
      const exercises = [...prev.exercises];
      [exercises[exIdx], exercises[to]] = [exercises[to], exercises[exIdx]];
      const normalized = exercises.map((ex, i) => {
        if (!ex.supersetGroupId) return ex;
        const adjacent =
          exercises[i - 1]?.supersetGroupId === ex.supersetGroupId ||
          exercises[i + 1]?.supersetGroupId === ex.supersetGroupId;
        return adjacent ? ex : { ...ex, supersetGroupId: null };
      });
      return { ...prev, exercises: normalized };
    });
  }, []);

  // Swap an exercise in place — keeps the same set count/structure (reset to blank) but
  // points at the new movement, and pulls in its last-session sets as the "previous".
  const replaceExercise = useCallback(async (exIdx, ex, settings) => {
    await seedHistoricalBests([ex.name], null);
    const history = await getLastSetsForExercise(ex.name);
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((cur, ei) => {
        if (ei !== exIdx) return cur;
        const sets = (cur.sets.length ? cur.sets : [{ ...DEFAULT_SET }]).map((_, i) => ({
          ...DEFAULT_SET,
          previous: makePrevious(history, i, cur.units),
        }));
        return {
          ...cur,
          id: ex.id ?? cur.id,
          name: ex.name,
          bodyPart: ex.bodyPart ?? '',
          equipment: ex.equipment ?? '',
          trackingType: ex.trackingType ?? 'reps',
          imageUrl: ex.imageUrl ?? null,
          note: '',
          sets,
        };
      });
      return { ...prev, exercises };
    });
  }, [seedHistoricalBests]);

  const toggleCollapse = useCallback(exIdx => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) =>
        ei === exIdx ? { ...ex, collapsed: !ex.collapsed } : ex
      );
      return { ...prev, exercises };
    });
  }, []);

  const toggleExerciseUnits = useCallback(exIdx => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return convertExerciseUnits(ex, ex.units === 'lbs' ? 'kg' : 'lbs');
      });
      return { ...prev, exercises };
    });
  }, []);

  // Set the weight unit for every exercise in the current session at once (used by the
  // in-workout Settings sheet so a single toggle changes the whole workout).
  const setAllUnits = useCallback(units => {
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, exercises: prev.exercises.map(ex => convertExerciseUnits(ex, units)) };
    });
  }, []);

  // Save the current live workout's exercises as a new reusable routine.
  const saveAsRoutine = useCallback(async title => {
    if (!session) return null;
    const routine = {
      id: genId(),
      title: (title || session.title || 'New Routine').trim(),
      defaultRest: workoutSettingsRef.current.defaultRestTime ?? 90,
      settings: workoutSettingsRef.current,
      exercises: (session.exercises || []).map(ex => ({
        id: ex.id,
        name: ex.name,
        bodyPart: ex.bodyPart ?? '',
        equipment: ex.equipment ?? '',
        trackingType: ex.trackingType ?? 'reps',
        imageUrl: ex.imageUrl ?? null,
        units: ex.units ?? 'kg',
        restTime: ex.restTime ?? null,
        sets: (ex.sets || []).map(s => ({ reps: s.reps ?? '', weight: s.weight ?? '', time: s.time ?? '' })),
      })),
      createdAt: new Date().toISOString(),
    };
    await saveRoutine(routine);
    refreshRoutines?.();
    return routine;
  }, [session, refreshRoutines]);

  const updateNote = useCallback((exIdx, note) => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) =>
        ei === exIdx ? { ...ex, note } : ex
      );
      return { ...prev, exercises };
    });
  }, []);

  const updateRestTime = useCallback((exIdx, secs) => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) =>
        ei === exIdx ? { ...ex, restTime: secs } : ex
      );
      return { ...prev, exercises };
    });
  }, []);

  const toggleSuperset = useCallback(exIdx => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      const a = exercises[exIdx];
      const b = exercises[exIdx + 1];
      if (!a || !b) return prev;

      const newId = genId;
      const linked = a.supersetGroupId && a.supersetGroupId === b.supersetGroupId;

      if (linked) {
        // Split the run at this boundary: b and everything after it that shares the
        // group gets a fresh id, so larger supersets break cleanly into two.
        const oldId = a.supersetGroupId;
        const splitId = newId();
        for (let k = exIdx + 1; k < exercises.length && exercises[k].supersetGroupId === oldId; k++) {
          exercises[k] = { ...exercises[k], supersetGroupId: splitId };
        }
      } else {
        // Link a & b under one id, merging into whichever already has a group so 3+
        // consecutive exercises can share a single superset.
        const groupId = a.supersetGroupId || b.supersetGroupId || newId();
        const bOld = b.supersetGroupId;
        exercises[exIdx] = { ...a, supersetGroupId: groupId };
        exercises[exIdx + 1] = { ...b, supersetGroupId: groupId };
        if (bOld && bOld !== groupId) {
          for (let k = exIdx + 2; k < exercises.length && exercises[k].supersetGroupId === bOld; k++) {
            exercises[k] = { ...exercises[k], supersetGroupId: groupId };
          }
        }
      }

      // Drop ids that ended up on a lone exercise (a group of one isn't a superset).
      const counts = {};
      exercises.forEach(e => { if (e.supersetGroupId) counts[e.supersetGroupId] = (counts[e.supersetGroupId] || 0) + 1; });
      const normalized = exercises.map(e =>
        e.supersetGroupId && counts[e.supersetGroupId] < 2 ? { ...e, supersetGroupId: null } : e
      );

      return { ...prev, exercises: normalized };
    });
  }, []);

  const skipRestTimer = useCallback(() => {
    setRestTimer(null);
  }, []);

  const adjustRestTimer = useCallback(delta => {
    setRestTimer(prev => {
      if (!prev) return prev;
      const next = Math.max(1, Math.min(600, prev.remaining + delta));
      return { ...prev, remaining: next, total: Math.max(prev.total, next), endsAt: Date.now() + next * 1000 };
    });
  }, []);

  const autoFillPrev = useCallback((exIdx, setIdx) => {
    setSession(prev => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => {
            if (si !== setIdx || !s.previous) return s;
            return {
              ...s,
              weight: s.previous.weight ?? s.weight,
              reps: s.previous.reps ?? s.reps,
              time: s.previous.time ?? s.time,
            };
          }),
        };
      });
      return { ...prev, exercises };
    });
  }, []);

  const value = {
    session,
    elapsed,
    restTimer,
    prBanner,
    prs,
    workoutSettings,
    isMinimized,
    startSession,
    cancelSession,
    finishSession,
    setTitle,
    setWorkoutSettings,
    minimize,
    expand,
    updateSet,
    completeSet,
    cycleSetType,
    addSet,
    removeSet,
    addExercise,
    removeExercise,
    moveExercise,
    replaceExercise,
    toggleCollapse,
    toggleExerciseUnits,
    setAllUnits,
    saveAsRoutine,
    updateNote,
    updateRestTime,
    toggleSuperset,
    skipRestTimer,
    adjustRestTimer,
    autoFillPrev,
  };

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used inside WorkoutProvider');
  return ctx;
}
