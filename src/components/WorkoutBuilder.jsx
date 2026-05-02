// WorkoutBuilder.jsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, Link2, ChevronUp, ChevronDown, X, ArrowLeft } from 'lucide-react';
import { saveWorkout, getAllWorkouts, deleteWorkout } from '../db';
import ExerciseLibrary from './ExerciseLibrary';

export default function WorkoutBuilder({ autoCreate, onAutoCreateDone }) {
  const [workouts, setWorkouts] = useState([]);
  const [editing, setEditing] = useState(null); // null = list, object = editing
  const [showExPicker, setShowExPicker] = useState(false);

  const loadWorkouts = async () => {
    const w = await getAllWorkouts();
    setWorkouts(w.sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => { loadWorkouts(); }, []);

  useEffect(() => {
    if (autoCreate) { createNew(); onAutoCreateDone(); }
  }, [autoCreate]);

  const createNew = () => {
    setEditing({ id: `w_${Date.now()}`, name: '', exercises: [], createdAt: Date.now() });
  };

  const handleSave = async () => {
    if (!editing.name.trim()) return;
    await saveWorkout(editing);
    await loadWorkouts();
    setEditing(null);
  };

  const addExercise = (ex) => {
    setEditing(prev => ({
      ...prev,
      exercises: [...prev.exercises, {
        ...ex,
        sets: [{ reps: '', weight: '', time: '', completed: false }],
        supersetWith: null,
      }]
    }));
    setShowExPicker(false);
  };

  const removeExercise = (idx) => {
    setEditing(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== idx) }));
  };

  const moveExercise = (idx, dir) => {
    setEditing(prev => {
      const exs = [...prev.exercises];
      const target = idx + dir;
      if (target < 0 || target >= exs.length) return prev;
      [exs[idx], exs[target]] = [exs[target], exs[idx]];
      return { ...prev, exercises: exs };
    });
  };

  const toggleSuperset = (idx) => {
    setEditing(prev => {
      const exs = [...prev.exercises];
      const next = idx + 1;
      if (next >= exs.length) return prev;
      exs[idx] = { ...exs[idx], supersetWith: exs[idx].supersetWith ? null : exs[next].id };
      return { ...prev, exercises: exs };
    });
  };

  const updateDefaultSets = (exIdx, field, value) => {
    setEditing(prev => {
      const exs = [...prev.exercises];
      exs[exIdx] = {
        ...exs[exIdx],
        sets: exs[exIdx].sets.map(s => ({ ...s, [field]: value }))
      };
      return { ...prev, exercises: exs };
    });
  };

  const addSet = (exIdx) => {
    setEditing(prev => {
      const exs = [...prev.exercises];
      const last = exs[exIdx].sets.at(-1) || {};
      exs[exIdx] = { ...exs[exIdx], sets: [...exs[exIdx].sets, { ...last, completed: false }] };
      return { ...prev, exercises: exs };
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setEditing(prev => {
      const exs = [...prev.exercises];
      if (exs[exIdx].sets.length <= 1) return prev;
      exs[exIdx] = { ...exs[exIdx], sets: exs[exIdx].sets.filter((_, i) => i !== setIdx) };
      return { ...prev, exercises: exs };
    });
  };

  // ── Workout list view ──
  if (!editing) {
    return (
      <div className="page">
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <h1 className="page-title">Workouts</h1>
          <button className="btn btn-primary" onClick={createNew}><Plus size={16} /> New</button>
        </div>

        {workouts.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>🏋️</span>
            <p>No workouts yet</p>
            <p className="text-sm">Create a workout to get started</p>
          </div>
        ) : (
          workouts.map(w => (
            <WorkoutCard key={w.id} workout={w} onEdit={() => setEditing(w)} onDelete={async () => { await deleteWorkout(w.id); loadWorkouts(); }} />
          ))
        )}
      </div>
    );
  }

  // ── Editor view ──
  return (
    <div className="page">
      <div className="flex items-center gap-8" style={{ marginBottom: 16 }}>
        <button className="btn-icon" onClick={() => setEditing(null)}><ArrowLeft size={18} /></button>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Edit Workout</h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Workout name (e.g. Push Day A)"
          value={editing.name}
          onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
          style={{ fontSize: 18, fontWeight: 600 }}
        />
      </div>

      {/* Exercises */}
      {editing.exercises.map((ex, exIdx) => {
        const isSuperset = !!ex.supersetWith;
        return (
          <div key={ex.id + exIdx} style={{ position: 'relative' }}>
            {isSuperset && (
              <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, display: 'flex', alignItems: 'stretch' }}>
                <div className="superset-bar" />
              </div>
            )}
            <div className="card" style={{ marginLeft: isSuperset ? 8 : 0 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
                  <div className="text-muted text-sm">{ex.bodyPart} · {ex.trackingType === 'time' ? '⏱ Timed' : '🔢 Reps'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => moveExercise(exIdx, -1)}><ChevronUp size={14} /></button>
                  <button className="btn-icon" onClick={() => moveExercise(exIdx, 1)}><ChevronDown size={14} /></button>
                  {exIdx < editing.exercises.length - 1 && (
                    <button className="btn-icon" style={{ color: isSuperset ? 'var(--accent)' : 'var(--text3)' }} onClick={() => toggleSuperset(exIdx)} title="Superset with next">
                      <Link2 size={14} />
                    </button>
                  )}
                  <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={() => removeExercise(exIdx)}><X size={14} /></button>
                </div>
              </div>

              {/* Set defaults */}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Default sets ({editing.exercises[exIdx].sets.length})</div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="set-row" style={{ marginBottom: 6 }}>
                  <span className="set-num">{setIdx + 1}</span>
                  {ex.trackingType === 'reps' ? (
                    <>
                      <input className="set-input" type="number" placeholder="Reps" value={set.reps} onChange={e => { const exs = [...editing.exercises]; exs[exIdx].sets[setIdx].reps = e.target.value; setEditing(p => ({ ...p, exercises: exs })); }} />
                      <input className="set-input" type="number" placeholder="kg" value={set.weight} onChange={e => { const exs = [...editing.exercises]; exs[exIdx].sets[setIdx].weight = e.target.value; setEditing(p => ({ ...p, exercises: exs })); }} />
                    </>
                  ) : (
                    <>
                      <input className="set-input" type="number" placeholder="Sec" value={set.time} onChange={e => { const exs = [...editing.exercises]; exs[exIdx].sets[setIdx].time = e.target.value; setEditing(p => ({ ...p, exercises: exs })); }} />
                      <input className="set-input" type="number" placeholder="kg" value={set.weight} onChange={e => { const exs = [...editing.exercises]; exs[exIdx].sets[setIdx].weight = e.target.value; setEditing(p => ({ ...p, exercises: exs })); }} />
                    </>
                  )}
                  <button className="btn-icon" onClick={() => removeSet(exIdx, setIdx)}><X size={12} /></button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px', marginTop: 4 }} onClick={() => addSet(exIdx)}>
                <Plus size={12} /> Add Set
              </button>
            </div>
          </div>
        );
      })}

      <button className="btn btn-secondary btn-full" style={{ marginBottom: 12 }} onClick={() => setShowExPicker(true)}>
        <Plus size={16} /> Add Exercise
      </button>

      <button className="btn btn-primary btn-full" onClick={handleSave} disabled={!editing.name.trim()} style={{ opacity: editing.name.trim() ? 1 : 0.5 }}>
        Save Workout
      </button>

      {showExPicker && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '85vh' }}>
            <div className="modal-handle" />
            <div className="flex justify-between items-center" style={{ marginBottom: 0 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Add Exercise</h2>
              <button className="btn-icon" onClick={() => setShowExPicker(false)}><X size={18} /></button>
            </div>
            <ExerciseLibrary onPickExercise={addExercise} />
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutCard({ workout, onEdit, onDelete }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="flex justify-between items-center">
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{workout.name}</div>
          <div className="text-muted text-sm" style={{ marginTop: 2 }}>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
            {workout.exercises.some(e => e.supersetWith) ? ' · includes supersets' : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {workout.exercises.slice(0, 4).map((e, i) => (
              <span key={i} className="chip" style={{ fontSize: 11 }}>{e.name}</span>
            ))}
            {workout.exercises.length > 4 && <span className="chip" style={{ fontSize: 11 }}>+{workout.exercises.length - 4} more</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" style={{ fontSize: 13, padding: '7px 12px' }} onClick={onEdit}>Edit</button>
          <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={onDelete}><Trash2 size={15} /></button>
        </div>
      </div>
    </div>
  );
}
