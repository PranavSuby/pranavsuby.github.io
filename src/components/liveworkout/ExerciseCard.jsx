import { useState, useRef } from 'react';
import {
  Check, MoreVertical, FileText, Clock, Link, ArrowUp, ArrowDown,
  Trash2, Dumbbell, RefreshCcw, Repeat, Calculator, TrendingUp,
} from 'lucide-react';
import { roundToLoadable, BAR_DEFAULTS } from '../../utils/plates';
import { useWorkout } from '../../contexts/WorkoutContext';
import { useApp } from '../../contexts/AppContext';
import PlateWarmupModal from '../PlateWarmupModal';
import { styles } from './styles';
import { SET_TYPES } from './setTypes';
import { NoteModal, RestTimeModal } from './Modals';

// ── Set Type Badge ────────────────────────────────────────────────────────────
function SetTypeBadge({ type, setIdx, onClick }) {
  const meta = SET_TYPES[type] ?? SET_TYPES.N;
  const label = (!type || type === 'N') ? String(setIdx + 1) : type;
  return (
    <button
      style={{
        background: meta.bg, color: meta.color,
        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
        width: 36, height: 36, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ── Set Row ───────────────────────────────────────────────────────────────────
function SetRow({ set, setIdx, exIdx, isTimeBased, exUnits, onTypeClick, onRirRpeClick }) {
  const { updateSet, completeSet, autoFillPrev, workoutSettings } = useWorkout();
  const { settings } = useApp();

  const prevLabel = set.previous
    ? `${set.previous.weight || '—'}×${set.previous.reps || set.previous.time || '—'}`
    : '—';

  // Last-session values shown as gray ghost placeholders; they finalize when the set
  // is checked off (see completeSet) unless the user types their own value first.
  const prevW = set.previous?.weight;
  const prevR = isTimeBased ? set.previous?.time : set.previous?.reps;
  const has = v => v != null && v !== '';
  const ghostWeight = has(prevW) ? String(prevW) : '—';
  const ghostReps   = has(prevR) ? String(prevR) : '—';

  const hasIntensity = workoutSettings.intensityMode !== 'none' && !isTimeBased;
  const cols = hasIntensity ? '36px 1fr 64px 64px 56px 40px' : '36px 1fr 64px 64px 40px';
  const intensityField = workoutSettings.intensityMode;
  const intensityVal = set[intensityField];

  return (
    <div style={{
      ...styles.setRow,
      gridTemplateColumns: cols,
      background: set.completed ? 'rgba(34,197,94,0.07)' : 'transparent',
      transition: 'background 0.2s',
    }}>
      {/* SET number / type badge */}
      <SetTypeBadge
        type={set.type || 'N'}
        setIdx={setIdx}
        onClick={() => onTypeClick(setIdx)}
      />

      {/* PREVIOUS */}
      <button style={styles.prevLabel} onClick={() => autoFillPrev(exIdx, setIdx)}>
        {prevLabel}
      </button>

      {/* KG / LBS */}
      <input
        className="lw-ghost-input"
        style={{
          ...styles.setInput,
          borderColor: set.completed ? 'rgba(34,197,94,0.35)' : 'var(--border2)',
        }}
        type="number"
        inputMode="decimal"
        placeholder={ghostWeight}
        value={set.weight ?? ''}
        onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
      />

      {/* REPS or SEC */}
      <input
        className="lw-ghost-input"
        style={{
          ...styles.setInput,
          borderColor: set.completed ? 'rgba(34,197,94,0.35)' : 'var(--border2)',
        }}
        type="number"
        inputMode="numeric"
        placeholder={ghostReps}
        value={isTimeBased ? (set.time ?? '') : (set.reps ?? '')}
        onChange={e => updateSet(exIdx, setIdx, isTimeBased ? 'time' : 'reps', e.target.value)}
      />

      {/* RIR / RPE — shown when intensity mode is active */}
      {hasIntensity && (
        <button
          style={{
            fontSize: 14, fontWeight: 700,
            color: intensityVal != null ? 'var(--text)' : 'var(--text3)',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center',
            padding: 0,
          }}
          onClick={() => onRirRpeClick(setIdx)}>
          {intensityVal != null ? intensityVal : intensityField.toUpperCase()}
        </button>
      )}

      {/* Checkmark */}
      <button
        style={{
          ...styles.checkBtn,
          background: set.completed ? 'var(--accent)' : 'transparent',
          border: `2px solid ${set.completed ? 'var(--accent)' : 'var(--border2)'}`,
        }}
        onClick={() => completeSet(exIdx, setIdx, settings)}
      >
        {set.completed && <Check size={13} color="#fff" strokeWidth={3} />}
      </button>
    </div>
  );
}

// ── Exercise 3-dot menu ───────────────────────────────────────────────────────
function ExerciseMenu({ exIdx, totalExercises, exUnits, linkedWithNext, onClose, onAddNote, onSetRest, onToggleSuperset, onMoveUp, onMoveDown, onRemove, onSwitchUnits, onTools, onSwap }) {
  const ref = useRef(null);

  return (
    <div ref={ref} style={styles.exMenuDrop}>
      <button style={styles.exMenuItem} onClick={onSwap}><Repeat size={14} />Swap Exercise</button>
      <button style={styles.exMenuItem} onClick={onTools}><Calculator size={14} />Plates &amp; Warm-up</button>
      <button style={styles.exMenuItem} onClick={onAddNote}><FileText size={14} />Add Note</button>
      <button style={styles.exMenuItem} onClick={onSetRest}><Clock size={14} />Set Rest Timer</button>
      <button style={styles.exMenuItem} onClick={onSwitchUnits}>
        <RefreshCcw size={14} />Switch to {exUnits === 'kg' ? 'LBS' : 'KG'}
      </button>
      {(linkedWithNext || exIdx < totalExercises - 1) && (
        <button style={styles.exMenuItem} onClick={onToggleSuperset}>
          <Link size={14} />{linkedWithNext ? 'Remove from Superset' : 'Superset with Next'}
        </button>
      )}
      <div style={styles.menuDivider} />
      <button style={{ ...styles.exMenuItem, opacity: exIdx === 0 ? 0.35 : 1 }} disabled={exIdx === 0} onClick={onMoveUp}>
        <ArrowUp size={14} />Move Up
      </button>
      <button style={{ ...styles.exMenuItem, opacity: exIdx === totalExercises - 1 ? 0.35 : 1 }} disabled={exIdx === totalExercises - 1} onClick={onMoveDown}>
        <ArrowDown size={14} />Move Down
      </button>
      <div style={styles.menuDivider} />
      <button style={{ ...styles.exMenuItem, color: 'var(--failure)' }} onClick={onRemove}>
        <Trash2 size={14} color="var(--failure)" />Remove Exercise
      </button>
    </div>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────
export function ExerciseCard({ ex, exIdx, totalExercises, linkedWithNext, showMenu, onMenuOpen, onMenuClose, onTypeClick, onRirRpeClick, onOpenDetail, onSwap }) {
  const { addSet, removeExercise, moveExercise, updateNote, updateRestTime, toggleSuperset, toggleExerciseUnits, workoutSettings } = useWorkout();
  const [editingNote, setEditingNote] = useState(false);
  const [editingRest, setEditingRest] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const isTimeBased = ex.trackingType === 'time';
  const exUnits = ex.units ?? 'kg';

  const hasIntensity = workoutSettings.intensityMode !== 'none' && !isTimeBased;
  const cols = hasIntensity ? '36px 1fr 64px 64px 56px 40px' : '36px 1fr 64px 64px 40px';

  return (
    <>
      <div style={styles.exCard}>
        {/* Card header */}
        <div style={styles.exCardHeader}>
          {/* Thumbnail + name — tappable to open detail */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={() => onOpenDetail && onOpenDetail(ex)}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
              background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {ex.imageUrl ? (
                <img src={ex.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Dumbbell size={18} color="var(--text3)" />
              )}
            </div>
            <span style={styles.exCardName}>{ex.name}</span>
          </div>

          {/* 3-dot menu */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button style={styles.iconBtn} onClick={() => showMenu ? onMenuClose() : onMenuOpen(exIdx)}>
              <MoreVertical size={18} color="var(--text2)" />
            </button>
            {showMenu && (
              <ExerciseMenu
                exIdx={exIdx}
                totalExercises={totalExercises}
                exUnits={exUnits}
                linkedWithNext={linkedWithNext}
                onClose={onMenuClose}
                onSwap={() => { onMenuClose(); onSwap && onSwap(exIdx); }}
                onTools={() => { onMenuClose(); setShowTools(true); }}
                onAddNote={() => { onMenuClose(); setEditingNote(true); }}
                onSetRest={() => { onMenuClose(); setEditingRest(true); }}
                onToggleSuperset={() => { onMenuClose(); toggleSuperset(exIdx); }}
                onMoveUp={() => { onMenuClose(); moveExercise(exIdx, -1); }}
                onMoveDown={() => { onMenuClose(); moveExercise(exIdx, 1); }}
                onRemove={() => { onMenuClose(); removeExercise(exIdx); }}
                onSwitchUnits={() => { onMenuClose(); toggleExerciseUnits(exIdx); }}
              />
            )}
          </div>
        </div>

        {/* Notes row — always visible */}
        <div
          onClick={() => setEditingNote(true)}
          style={{
            fontSize: 14, padding: '0 0 8px', cursor: 'pointer',
            color: ex.note ? 'var(--text2)' : 'var(--text3)',
            fontStyle: ex.note ? 'normal' : 'italic',
          }}
        >
          {ex.note || 'Add notes here...'}
        </div>

        {/* Rest timer row — always visible */}
        <div
          onClick={() => setEditingRest(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)', paddingBottom: 12, cursor: 'pointer' }}
        >
          <Clock size={14} />
          Rest Timer: {ex.restTime ? `${ex.restTime}s` : 'OFF'}
        </div>

        {/* Progressive-overload hint from last session */}
        {(() => {
          const prev = (ex.sets ?? []).map(s => s.previous).find(p => p && +p.weight > 0);
          if (!prev || isTimeBased) return null;
          const inc = exUnits === 'kg' ? 2.5 : 5;
          const next = roundToLoadable((+prev.weight) + inc, BAR_DEFAULTS[exUnits] ?? 20, exUnits);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--pr-green)', paddingBottom: 12 }}>
              <TrendingUp size={13} />
              Last {prev.weight}{exUnits}×{prev.reps} — aim {next}{exUnits} to progress
            </div>
          );
        })()}

        {/* Column headers */}
        <div style={{ ...styles.setHeaders, gridTemplateColumns: cols }}>
          <span style={{ width: 36, textAlign: 'center' }}>SET</span>
          <span style={{ flex: 1, textAlign: 'center' }}>PREVIOUS</span>
          <span style={{ width: 64, textAlign: 'center' }}>{exUnits.toUpperCase()}</span>
          <span style={{ width: 64, textAlign: 'center' }}>{isTimeBased ? 'SEC' : 'REPS'}</span>
          {hasIntensity && (
            <span style={{ width: 56, textAlign: 'center' }}>{workoutSettings.intensityMode.toUpperCase()}</span>
          )}
          <span style={{ width: 40 }} />
        </div>

        {/* Set rows */}
        {(ex.sets ?? []).map((set, si) => (
          <SetRow
            key={si}
            set={set}
            setIdx={si}
            exIdx={exIdx}
            isTimeBased={isTimeBased}
            exUnits={exUnits}
            onTypeClick={(si) => onTypeClick(exIdx, si)}
            onRirRpeClick={(si) => onRirRpeClick(exIdx, si)}
          />
        ))}

        {/* Add Set */}
        <button style={styles.addSetBtn} onClick={() => addSet(exIdx)}>
          + Add Set
        </button>
      </div>

      {editingNote && (
        <NoteModal
          currentNote={ex.note}
          onSave={note => updateNote(exIdx, note)}
          onClose={() => setEditingNote(false)}
        />
      )}
      {editingRest && (
        <RestTimeModal
          currentRest={ex.restTime}
          defaultRest={workoutSettings.defaultRestTime ?? 90}
          onSave={secs => updateRestTime(exIdx, secs)}
          onClose={() => setEditingRest(false)}
        />
      )}
      {showTools && (
        <PlateWarmupModal
          initialWeight={Math.max(0, ...(ex.sets ?? []).map(s => +s.weight || 0))}
          unit={exUnits}
          onClose={() => setShowTools(false)}
        />
      )}
    </>
  );
}

// ── Superset Wrapper ──────────────────────────────────────────────────────────
export function SupersetWrap({ children }) {
  return (
    <div style={styles.supersetWrap}>
      <div style={styles.supersetLabel}>SUPERSET</div>
      {children}
    </div>
  );
}
