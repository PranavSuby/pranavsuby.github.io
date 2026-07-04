import { useState } from 'react';
import { Check, ChevronLeft, Plus, Trash2, X, Dumbbell } from 'lucide-react';
import { saveSession } from '../../db';
import { useApp } from '../../contexts/AppContext';
import { Sheet, useBackClose } from '../../ui';
import { SET_TYPES } from '../liveworkout/setTypes';
import ExercisesTab from '../ExercisesTab';

// Local-time parts for the date/time inputs (ISO string → 'YYYY-MM-DD' / 'HH:MM').
function toDateParts(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const inputStyle = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 16, padding: '10px 12px',
  outline: 'none',
};
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.7px', marginBottom: 6, display: 'block',
};
const setInputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 16, fontWeight: 600,
  padding: '8px 4px', textAlign: 'center', outline: 'none',
};

const SET_TYPE_ORDER = ['N', 'W', 'D', 'F'];

// ── EditSessionView ────────────────────────────────────────────────────────────
// Full-screen editor for an already-logged workout. Edits a local draft and only
// writes back to IndexedDB when the user taps Save.
export default function EditSessionView({ session, onClose, onSaved }) {
  const { settings } = useApp();
  useBackClose(onClose);

  const [draft, setDraft] = useState(() => ({
    ...session,
    exercises: (session.exercises || []).map(ex => ({
      ...ex,
      sets: (ex.sets || []).map(s => ({ ...s })),
    })),
  }));
  const [parts, setParts] = useState(() => toDateParts(session.date));
  const [durationMin, setDurationMin] = useState(() =>
    session.duration != null ? String(Math.round(session.duration / 60)) : ''
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateExercise = (exIdx, updater) => {
    setDraft(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => (i === exIdx ? updater(ex) : ex)),
    }));
  };

  const updateSet = (exIdx, setIdx, patch) => {
    updateExercise(exIdx, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)),
    }));
  };

  const cycleType = (exIdx, setIdx) => {
    updateExercise(exIdx, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => {
        if (i !== setIdx) return s;
        const next = SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(s.type || 'N') + 1) % SET_TYPE_ORDER.length];
        return { ...s, type: next };
      }),
    }));
  };

  const addSet = exIdx => {
    updateExercise(exIdx, ex => {
      const last = ex.sets[ex.sets.length - 1];
      const newSet = last
        ? { ...last, completed: true, previous: null }
        : { type: 'N', weight: '', reps: '', time: '', rpe: null, rir: null, completed: true, previous: null };
      return { ...ex, sets: [...ex.sets, newSet] };
    });
  };

  const removeSet = (exIdx, setIdx) => {
    updateExercise(exIdx, ex => ({ ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) }));
  };

  const removeExercise = exIdx => {
    const name = draft.exercises[exIdx]?.name || 'this exercise';
    if (!window.confirm(`Remove ${name} from this workout?`)) return;
    setDraft(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== exIdx) }));
  };

  const handlePick = ex => {
    setShowPicker(false);
    setDraft(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          id: ex.id ?? String(Date.now()),
          name: ex.name,
          bodyPart: ex.bodyPart ?? '',
          equipment: ex.equipment ?? '',
          trackingType: ex.trackingType ?? 'reps',
          imageUrl: ex.imageUrl ?? null,
          units: settings?.units ?? 'kg',
          supersetGroupId: null,
          note: '',
          restTime: null,
          sets: [{ type: 'N', weight: '', reps: '', time: '', rpe: null, rir: null, completed: true, previous: null }],
        },
      ],
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Rebuild the ISO date from the (local) date + time inputs.
      const [y, m, d] = parts.date.split('-').map(Number);
      const [hh, mm] = parts.time.split(':').map(Number);
      const when = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);

      const mins = parseInt(durationMin, 10);
      const duration = Number.isFinite(mins) && mins >= 0 ? mins * 60 : draft.duration;

      const updated = {
        ...draft,
        title: (draft.title || '').trim() || 'Workout',
        date: when.toISOString(),
        startedAt: when.getTime(),
        duration,
        // Drop exercises the user emptied of sets — nothing left to show or count.
        exercises: draft.exercises.filter(ex => (ex.sets || []).length > 0),
      };
      await saveSession(updated);
      onSaved?.(updated);
    } catch {
      setSaving(false);
      window.alert('Could not save changes. Please try again.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 170, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 10px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="Cancel"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Edit Workout</div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff',
            fontSize: 14, fontWeight: 700, padding: '8px 18px', cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Meta */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Title</label>
          <input
            style={inputStyle}
            value={draft.title || ''}
            onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Workout"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={parts.date}
              onChange={e => e.target.value && setParts(p => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Time</label>
            <input
              type="time"
              style={inputStyle}
              value={parts.time}
              onChange={e => e.target.value && setParts(p => ({ ...p, time: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Length (min)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              style={inputStyle}
              value={durationMin}
              onChange={e => setDurationMin(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        {/* Exercises */}
        {draft.exercises.map((ex, exIdx) => {
          const isTimeBased = ex.trackingType === 'time';
          const exUnits = ex.units ?? settings?.units ?? 'kg';
          return (
            <div key={exIdx} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
              {/* Exercise header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {ex.imageUrl
                    ? <img src={ex.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Dumbbell size={16} color="var(--text3)" />}
                </div>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.name}
                </span>
                <button
                  onClick={() => removeExercise(exIdx)}
                  aria-label="Remove exercise"
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, display: 'flex' }}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 40px 36px', gap: 8, marginBottom: 6, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                <span>Set</span>
                <span>{exUnits}</span>
                <span>{isTimeBased ? 'Sec' : 'Reps'}</span>
                <span>Done</span>
                <span />
              </div>

              {/* Set rows */}
              {ex.sets.map((set, setIdx) => {
                const meta = SET_TYPES[set.type] ?? SET_TYPES.N;
                const label = (!set.type || set.type === 'N') ? String(setIdx + 1) : set.type;
                return (
                  <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 40px 36px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <button
                      onClick={() => cycleType(exIdx, setIdx)}
                      style={{
                        background: meta.bg, color: meta.color, border: 'none', borderRadius: 8,
                        fontWeight: 700, fontSize: 13, width: 36, height: 38, cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      style={setInputStyle}
                      value={set.weight ?? ''}
                      onChange={e => updateSet(exIdx, setIdx, { weight: e.target.value })}
                      placeholder="—"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      style={setInputStyle}
                      value={isTimeBased ? (set.time ?? '') : (set.reps ?? '')}
                      onChange={e => updateSet(exIdx, setIdx, isTimeBased ? { time: e.target.value } : { reps: e.target.value })}
                      placeholder="—"
                    />
                    <button
                      onClick={() => updateSet(exIdx, setIdx, { completed: !set.completed })}
                      aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                      style={{
                        width: 26, height: 26, margin: '0 auto', borderRadius: 7, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: set.completed ? 'var(--accent)' : 'transparent',
                        border: `2px solid ${set.completed ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {set.completed && <Check size={13} color="#fff" strokeWidth={3} />}
                    </button>
                    <button
                      onClick={() => removeSet(exIdx, setIdx)}
                      aria-label="Remove set"
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, display: 'flex', justifyContent: 'center' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => addSet(exIdx)}
                style={{
                  width: '100%', background: 'var(--bg3)', border: '1px dashed var(--border)',
                  borderRadius: 10, color: 'var(--text2)', fontSize: 13, fontWeight: 600,
                  padding: '9px 0', cursor: 'pointer', marginTop: 2,
                }}
              >
                + Add Set
              </button>
            </div>
          );
        })}

        {draft.exercises.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>
            No exercises in this workout. Add one below, or delete the workout instead.
          </div>
        )}

        <button
          onClick={() => setShowPicker(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
            color: 'var(--accent)', fontSize: 14, fontWeight: 700, padding: '13px 0', cursor: 'pointer',
          }}
        >
          <Plus size={16} style={{ marginRight: 8 }} />
          Add Exercise
        </button>
      </div>

      {/* Exercise picker */}
      <Sheet open={showPicker} onClose={() => setShowPicker(false)} title="Add Exercise" tall flex>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginLeft: -16, marginRight: -16, marginBottom: 'calc(-20px - var(--safe-bottom, 0px))' }}>
          <ExercisesTab pickerMode pickerOpen={showPicker} onPick={handlePick} />
        </div>
      </Sheet>
    </div>
  );
}
