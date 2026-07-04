import { useState } from 'react';
import { Plus, ArrowLeft, ArrowUp, ArrowDown, Clock, SlidersHorizontal, X } from 'lucide-react';
import { saveRoutine } from '../../db';
import { useApp } from '../../contexts/AppContext';
import ExercisesTab from '../ExercisesTab';
import { AppScreen, Sheet, useBackClose } from '../../ui';
import { styles } from './styles';
import { makeEmptyRoutine, makeEmptyExercise } from './helpers';

// ── ExerciseBuilderCard ───────────────────────────────────────────────────────
function ExerciseBuilderCard({ ex, exIdx, total, defaultUnits, routineRest, onChange, onRemove, onMoveUp, onMoveDown }) {
  const isTimeBased = ex.trackingType === 'time';
  const [showOpts, setShowOpts] = useState(false);
  const units = ex.units || defaultUnits || 'kg';

  function handleSetChange(setIdx, field, value) {
    const newSets = ex.sets.map((s, i) =>
      i === setIdx ? { ...s, [field]: value } : s
    );
    onChange({ ...ex, sets: newSets });
  }

  function addSet() {
    const last = ex.sets[ex.sets.length - 1] ?? { reps: '', weight: '', time: '' };
    onChange({ ...ex, sets: [...ex.sets, { weight: last.weight ?? '', reps: last.reps ?? '', time: last.time ?? '' }] });
  }

  function removeSet(setIdx) {
    if (ex.sets.length <= 1) return;
    onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) });
  }

  return (
    <div style={styles.builderCard}>
      {/* Header row */}
      <div style={styles.builderCardHeader}>
        <div style={{ flex: 1 }}>
          <div style={styles.builderExName}>{ex.name}</div>
          {ex.bodyPart ? (
            <span style={styles.bodyPartBadge}>{ex.bodyPart}</span>
          ) : null}
        </div>
        <div style={styles.builderCardControls}>
          <span style={styles.setCountBadge}>{ex.sets.length} sets</span>
          <button
            style={{ ...styles.iconBtn, color: showOpts ? 'var(--accent)' : undefined }}
            onClick={() => setShowOpts(o => !o)}
            aria-label="Exercise options"
          >
            <SlidersHorizontal size={14} color={showOpts ? 'var(--accent)' : 'var(--text2)'} />
          </button>
          <button
            style={{ ...styles.iconBtn, opacity: exIdx === 0 ? 0.3 : 1 }}
            disabled={exIdx === 0}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            <ArrowUp size={14} color="var(--text2)" />
          </button>
          <button
            style={{ ...styles.iconBtn, opacity: exIdx === total - 1 ? 0.3 : 1 }}
            disabled={exIdx === total - 1}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            <ArrowDown size={14} color="var(--text2)" />
          </button>
          <button style={styles.iconBtn} onClick={onRemove} aria-label="Remove exercise">
            <X size={14} color="var(--failure)" />
          </button>
        </div>
      </div>

      {/* Per-exercise options */}
      {showOpts && (
        <div style={styles.optsPanel}>
          <div style={styles.optRow}>
            <span style={styles.optLabel}>Weight unit</span>
            <div style={styles.optSeg}>
              {['kg', 'lbs'].map(u => (
                <button key={u} type="button"
                  style={{ ...styles.optSegBtn, ...(units === u ? styles.optSegBtnActive : {}) }}
                  onClick={() => onChange({ ...ex, units: u })}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.optRow}>
            <span style={styles.optLabel}>Rest timer</span>
            <div style={styles.restInputWrap}>
              <input
                style={styles.restInput}
                type="number" inputMode="numeric" min="0" max="600"
                placeholder={`${routineRest ?? 90}`}
                value={ex.restTime ?? ''}
                onChange={e => onChange({ ...ex, restTime: e.target.value === '' ? null : Number(e.target.value) })}
              />
              <span style={styles.restUnit}>sec</span>
            </div>
          </div>
          <div style={styles.optRow}>
            <span style={styles.optLabel}>Note</span>
            <input
              style={styles.optNoteInput}
              placeholder="e.g. tempo, cue, machine seat #"
              value={ex.note ?? ''}
              onChange={e => onChange({ ...ex, note: e.target.value })}
              maxLength={120}
            />
          </div>
        </div>
      )}

      {/* Set rows */}
      <div style={styles.builderSetHeader}>
        <span style={{ width: 28, textAlign: 'center' }}>SET</span>
        <span style={{ flex: 1, textAlign: 'center' }}>{units.toUpperCase()}</span>
        <span style={{ flex: 1, textAlign: 'center' }}>{isTimeBased ? 'SEC' : 'REPS'}</span>
        <span style={{ width: 28 }} />
      </div>
      {ex.sets.map((s, si) => (
        <div key={si} style={styles.builderSetRow}>
          <span style={styles.builderSetNum}>{si + 1}</span>
          <input
            style={styles.setInput}
            type="number"
            inputMode="decimal"
            placeholder="—"
            value={s.weight}
            onChange={e => handleSetChange(si, 'weight', e.target.value)}
          />
          <input
            style={styles.setInput}
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={isTimeBased ? (s.time ?? '') : (s.reps ?? '')}
            onChange={e => handleSetChange(si, isTimeBased ? 'time' : 'reps', e.target.value)}
          />
          <button
            style={{ ...styles.iconBtn, opacity: ex.sets.length <= 1 ? 0.3 : 1 }}
            disabled={ex.sets.length <= 1}
            onClick={() => removeSet(si)}
            aria-label="Remove set"
          >
            <X size={12} color="var(--text3)" />
          </button>
        </div>
      ))}

      {/* Add Set */}
      <button style={styles.addSetBtn} onClick={addSet}>
        + Add Set
      </button>
    </div>
  );
}

// ── BuilderView ───────────────────────────────────────────────────────────────
export function BuilderView({ initial, onBack, onSaved }) {
  useBackClose(onBack);
  const { settings } = useApp();
  const defaultUnits = settings?.units ?? 'kg';
  const [routine, setRoutine] = useState(() =>
    initial ? { ...initial, exercises: initial.exercises.map(e => ({ ...e, sets: e.sets?.length ? e.sets : [{ reps: '', weight: '' }] })) } : makeEmptyRoutine()
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const isNew = !initial;

  function updateExercise(idx, updated) {
    setRoutine(r => ({
      ...r,
      exercises: r.exercises.map((e, i) => (i === idx ? updated : e)),
    }));
  }

  function removeExercise(idx) {
    setRoutine(r => ({
      ...r,
      exercises: r.exercises.filter((_, i) => i !== idx),
    }));
  }

  function moveExercise(idx, dir) {
    const target = idx + dir;
    setRoutine(r => {
      if (target < 0 || target >= r.exercises.length) return r;
      const arr = [...r.exercises];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...r, exercises: arr };
    });
  }

  function handlePick(ex) {
    setShowPicker(false);
    setRoutine(r => ({
      ...r,
      exercises: [...r.exercises, makeEmptyExercise(ex, defaultUnits)],
    }));
  }

  async function handleSave() {
    if (!routine.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveRoutine({ ...routine, updatedAt: new Date().toISOString() });
      onSaved();
    } catch (err) {
      setSaveError('Could not save routine. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppScreen noPadding header={
        <div style={styles.builderHeader}>
          <button style={styles.backBtn} onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} color="var(--text)" />
          </button>
          <div style={styles.builderHeaderTitle}>
            {isNew ? 'New Routine' : routine.title || 'Edit Routine'}
          </div>
        </div>
      }>
        {/* Name input */}
        <div style={styles.builderSection}>
          <input
            style={styles.routineNameInput}
            placeholder="Routine Name"
            value={routine.title}
            onChange={e => setRoutine(r => ({ ...r, title: e.target.value }))}
            maxLength={80}
          />
        </div>

        {/* Default rest */}
        <div style={styles.restRow}>
          <div style={styles.restLabel}>
            <Clock size={14} color="var(--text2)" style={{ marginRight: 6 }} />
            Default Rest
          </div>
          <div style={styles.restInputWrap}>
            <input
              style={styles.restInput}
              type="number"
              inputMode="numeric"
              min="0"
              max="600"
              value={routine.defaultRest ?? 90}
              onChange={e =>
                setRoutine(r => ({ ...r, defaultRest: Number(e.target.value) }))
              }
            />
            <span style={styles.restUnit}>sec</span>
          </div>
        </div>

        {/* Exercise list */}
        {routine.exercises.length === 0 ? (
          <div style={styles.builderEmptyState}>
            No exercises yet. Tap "Add Exercise" below.
          </div>
        ) : (
          <div style={styles.builderExList}>
            {routine.exercises.map((ex, idx) => (
              <ExerciseBuilderCard
                key={ex.id ?? idx}
                ex={ex}
                exIdx={idx}
                total={routine.exercises.length}
                defaultUnits={defaultUnits}
                routineRest={routine.defaultRest}
                onChange={updated => updateExercise(idx, updated)}
                onRemove={() => removeExercise(idx)}
                onMoveUp={() => moveExercise(idx, -1)}
                onMoveDown={() => moveExercise(idx, 1)}
              />
            ))}
          </div>
        )}

        {/* Add Exercise button */}
        <button
          style={styles.addExerciseBtn}
          onClick={() => setShowPicker(true)}
        >
          <Plus size={16} style={{ marginRight: 6 }} />
          Add Exercise
        </button>

        {/* Save button */}
        <button
          style={{
            ...styles.saveBtn,
            opacity: !routine.title.trim() || saving ? 0.45 : 1,
            cursor: !routine.title.trim() || saving ? 'not-allowed' : 'pointer',
          }}
          disabled={!routine.title.trim() || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Routine'}
        </button>
        {saveError && (
          <div style={{ color: 'var(--failure)', fontSize: 13, marginTop: 8, textAlign: 'center', paddingBottom: 8 }}>
            {saveError}
          </div>
        )}
      </AppScreen>

      {/* Exercise picker — always mounted after first open */}
      <Sheet open={showPicker} onClose={() => setShowPicker(false)} title="Add Exercise" tall flex keepMounted>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginLeft: -16, marginRight: -16, marginBottom: 'calc(-20px - var(--safe-bottom, 0px))' }}>
          <ExercisesTab pickerMode pickerOpen={showPicker} onPick={handlePick} />
        </div>
      </Sheet>
    </>
  );
}
