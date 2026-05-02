// ActiveSession.jsx
import { useState, useEffect, useRef } from 'react';
import { Check, X, Plus, ChevronDown, ChevronUp, Clock, Timer, Play, Pause, Square } from 'lucide-react';
import { saveSession } from '../db';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function ActiveSession({ workout, onFinish, onCancel }) {
  const [exercises, setExercises] = useState(
    workout.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({ ...s, completed: false })),
      collapsed: false,
    }))
  );
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(null); // seconds remaining
  const [timerRunning, setTimerRunning] = useState({});  // exIdx+setIdx -> bool
  const [timerElapsed, setTimerElapsed] = useState({});
  const startedAt = useRef(Date.now());
  const intervalRef = useRef(null);
  const restRef = useRef(null);

  // Workout timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer === null) return;
    if (restTimer <= 0) { setRestTimer(null); return; }
    restRef.current = setTimeout(() => setRestTimer(t => t - 1), 1000);
    return () => clearTimeout(restRef.current);
  }, [restTimer]);

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => {
      const exs = [...prev];
      exs[exIdx] = {
        ...exs[exIdx],
        sets: exs[exIdx].sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s)
      };
      return exs;
    });
  };

  const completeSet = (exIdx, setIdx) => {
    setExercises(prev => {
      const exs = [...prev];
      exs[exIdx] = {
        ...exs[exIdx],
        sets: exs[exIdx].sets.map((s, i) => i === setIdx ? { ...s, completed: !s.completed } : s)
      };
      return exs;
    });
    // Start rest timer on complete
    const set = exercises[exIdx].sets[setIdx];
    if (!set.completed) setRestTimer(90);
  };

  const addSet = (exIdx) => {
    setExercises(prev => {
      const exs = [...prev];
      const last = exs[exIdx].sets.at(-1) || {};
      exs[exIdx] = { ...exs[exIdx], sets: [...exs[exIdx].sets, { ...last, completed: false }] };
      return exs;
    });
  };

  const toggleCollapse = (exIdx) => {
    setExercises(prev => prev.map((ex, i) => i === exIdx ? { ...ex, collapsed: !ex.collapsed } : ex));
  };

  // Timed exercise controls
  const startStopTimer = (exIdx, setIdx) => {
    const key = `${exIdx}_${setIdx}`;
    setTimerRunning(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const keys = Object.keys(timerRunning).filter(k => timerRunning[k]);
    if (keys.length === 0) return;
    const t = setInterval(() => {
      setTimerElapsed(prev => {
        const next = { ...prev };
        keys.forEach(k => { next[k] = (prev[k] || 0) + 1; });
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  const stopAndLogTimer = (exIdx, setIdx) => {
    const key = `${exIdx}_${setIdx}`;
    const elapsed = timerElapsed[key] || 0;
    setTimerRunning(prev => ({ ...prev, [key]: false }));
    updateSet(exIdx, setIdx, 'time', elapsed);
  };

  const handleFinish = async () => {
    const session = {
      id: `s_${Date.now()}`,
      workoutId: workout.id,
      workoutName: workout.name,
      date: new Date().toISOString(),
      duration: elapsed,
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        trackingType: ex.trackingType,
        sets: ex.sets,
      })),
    };
    await saveSession(session);
    onFinish();
  };

  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const completedSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0);
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
          <div>
            <div className="font-heading" style={{ fontSize: 26 }}>{workout.name}</div>
            <div className="text-muted text-sm" style={{ display: 'flex', gap: 12, marginTop: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> {fmtTime(elapsed)}</span>
              <span>{completedSets}/{totalSets} sets</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '7px 12px' }} onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: '7px 12px' }} onClick={handleFinish}>Finish</button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Exercises */}
      {exercises.map((ex, exIdx) => {
        const isSuperset = !!ex.supersetWith;
        return (
          <div key={ex.id + exIdx} style={{ position: 'relative' }}>
            {isSuperset && (
              <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, display: 'flex', alignItems: 'stretch' }}>
                <div className="superset-bar" />
              </div>
            )}
            <div className="card" style={{ marginLeft: isSuperset ? 8 : 0, marginBottom: 10 }}>
              {/* Exercise header */}
              <button
                onClick={() => toggleCollapse(exIdx)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ex.collapsed ? 0 : 12, color: 'var(--text)' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
                  <div className="text-sm text-muted">
                    {ex.sets.filter(s => s.completed).length}/{ex.sets.length} sets
                    {isSuperset && <span className="chip chip-accent" style={{ marginLeft: 6, fontSize: 10 }}>Superset</span>}
                  </div>
                </div>
                {ex.collapsed ? <ChevronDown size={18} color="var(--text3)" /> : <ChevronUp size={18} color="var(--text3)" />}
              </button>

              {!ex.collapsed && (
                <>
                  {/* Column headers */}
                  <div className="set-row" style={{ marginBottom: 4 }}>
                    <div className="set-num" style={{ fontSize: 10, color: 'var(--text3)' }}>SET</div>
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>
                      {ex.trackingType === 'time' ? 'Time (s)' : 'Reps'}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>
                      Weight (kg)
                    </div>
                    <div style={{ width: 36 }} />
                  </div>

                  {ex.sets.map((set, setIdx) => {
                    const key = `${exIdx}_${setIdx}`;
                    const isRunning = timerRunning[key];
                    const tElapsed = timerElapsed[key] || 0;

                    return (
                      <div key={setIdx} className="set-row" style={{ marginBottom: 8 }}>
                        <span className="set-num">{setIdx + 1}</span>

                        {ex.trackingType === 'time' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <input
                              className={`set-input ${set.completed ? 'set-completed' : ''}`}
                              type="number"
                              placeholder="0"
                              value={isRunning ? tElapsed : (set.time || '')}
                              onChange={e => updateSet(exIdx, setIdx, 'time', e.target.value)}
                              readOnly={isRunning}
                            />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn-icon"
                                style={{ flex: 1, fontSize: 11, color: isRunning ? 'var(--accent2)' : 'var(--accent)' }}
                                onClick={() => isRunning ? stopAndLogTimer(exIdx, setIdx) : startStopTimer(exIdx, setIdx)}
                              >
                                {isRunning ? <><Square size={12} /> Stop</> : <><Play size={12} /> Start</>}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <input
                            className={`set-input ${set.completed ? 'set-completed' : ''}`}
                            type="number"
                            placeholder="0"
                            value={set.reps || ''}
                            onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          />
                        )}

                        <input
                          className={`set-input ${set.completed ? 'set-completed' : ''}`}
                          type="number"
                          placeholder="0"
                          value={set.weight || ''}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                        />

                        <button
                          style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${set.completed ? 'var(--accent)' : 'var(--border)'}`, background: set.completed ? 'var(--accent)' : 'transparent', color: set.completed ? '#0a0a0a' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => completeSet(exIdx, setIdx)}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    );
                  })}

                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px', marginTop: 4 }} onClick={() => addSet(exIdx)}>
                    <Plus size={12} /> Add Set
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} onClick={handleFinish}>
        Finish Workout
      </button>

      {/* Rest timer */}
      {restTimer !== null && (
        <div className="rest-timer">
          <Timer size={18} />
          Rest {fmtTime(restTimer)}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }} onClick={() => setRestTimer(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
