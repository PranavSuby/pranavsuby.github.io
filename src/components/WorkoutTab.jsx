import { useState, useMemo } from 'react';
import { Play, Plus } from 'lucide-react';
import { deleteRoutine, saveRoutine } from '../db';
import { genId } from '../utils/id';
import { useWorkout } from '../contexts/WorkoutContext';
import { useApp } from '../contexts/AppContext';
import { AppScreen } from '../ui';
import { styles } from './workout/styles';
import { RoutineCard } from './workout/RoutineCard';
import { BuilderView } from './workout/BuilderView';

// ── WorkoutTab (main export) ──────────────────────────────────────────────────
export default function WorkoutTab({ active }) {
  const { startSession, session, cancelSession, expand } = useWorkout();
  const { settings, routines, sessions, refreshRoutines, dataReady } = useApp();
  const [editing, setEditing] = useState(null);

  const lastDates = useMemo(() => {
    const dates = {};
    for (const s of sessions) {
      if (!s.routineId) continue;
      if (!dates[s.routineId] || s.date > dates[s.routineId]) {
        dates[s.routineId] = s.date;
      }
    }
    return dates;
  }, [sessions]);

  async function handleDelete(id) {
    await deleteRoutine(id);
    refreshRoutines();
  }

  async function handleDuplicate(routine) {
    await saveRoutine({
      ...routine,
      id: genId(),
      title: `${routine.title || 'Untitled Routine'} (copy)`,
      createdAt: new Date().toISOString(),
    });
    refreshRoutines();
  }

  // A workout can be minimized while browsing this tab — starting another one must
  // never silently destroy it. Offer to resume; only discard on explicit confirm.
  async function clearOrKeepActive() {
    if (!session) return true;
    const discard = window.confirm(
      `"${session.title}" is still in progress. Discard it and start a new workout?\n\n(Cancel to keep the current workout.)`
    );
    if (!discard) { expand(); return false; }
    await cancelSession();
    return true;
  }

  async function handleStartEmpty() {
    if (!(await clearOrKeepActive())) return;
    startSession({ title: 'Quick Workout', exercises: [] }, settings);
  }

  async function handleStartRoutine(routine) {
    if (!(await clearOrKeepActive())) return;
    startSession(routine, settings);
  }

  if (editing !== null) {
    return (
      <BuilderView
        initial={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onSaved={() => { setEditing(null); refreshRoutines(); }}
      />
    );
  }

  return (
    <AppScreen noPadding header={
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>Workout</h2>
      </div>
    }>
      {/* Start Empty Workout */}
      <div style={{ padding: '16px 16px 24px' }}>
        <button style={styles.startEmptyBtn} onClick={handleStartEmpty}>
          <Play size={16} style={{ marginRight: 8 }} />
          Start Empty Workout
        </button>
      </div>

      {/* My Routines */}
      <div style={styles.sectionRow}>
        <span style={styles.sectionLabel}>My Routines</span>
        <button style={styles.newRoutineBtn} onClick={() => setEditing('new')}>
          <Plus size={15} style={{ marginRight: 4 }} />
          New Routine
        </button>
      </div>

      {!dataReady ? (
        <div style={styles.emptyState}>Loading…</div>
      ) : routines.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ marginBottom: 6 }}>No routines yet.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Tap "New Routine" to get started.
          </div>
        </div>
      ) : (
        <div style={styles.routineList}>
          {routines.map(routine => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              lastDate={lastDates[routine.id] ?? null}
              onStart={() => handleStartRoutine(routine)}
              onEdit={() => setEditing(routine)}
              onDelete={() => handleDelete(routine.id)}
              onDuplicate={() => handleDuplicate(routine)}
            />
          ))}
        </div>
      )}
    </AppScreen>
  );
}
