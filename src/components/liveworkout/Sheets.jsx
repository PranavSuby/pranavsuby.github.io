import { useState } from 'react';
import { useWorkout } from '../../contexts/WorkoutContext';
import { useApp } from '../../contexts/AppContext';
import { useDragToClose, useBackClose } from '../../ui';
import { styles } from './styles';
import { SET_TYPE_OPTIONS } from './setTypes';
import { RestTimeModal } from './Modals';

// ── Set Type Sheet ────────────────────────────────────────────────────────────
export function SetTypeSheet({ exIdx, setIdx, onClose }) {
  const { updateSet, removeSet } = useWorkout();
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose); // Back closes the sheet, not the app
  return (
    <div style={{ ...styles.sheetBackdrop, display: 'flex' }} onClick={onClose}>
      <div style={styles.sheetPanelAuto} ref={panelRef} {...zoneProps} onClick={e => e.stopPropagation()}>
        <div style={styles.sheetHandle} {...handleProps} />
        <div style={{ padding: '16px 20px 8px', fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
          Select Set Type
        </div>
        {SET_TYPE_OPTIONS.map(({ type, label, color, bg }) => (
          <button key={type}
            onClick={() => { updateSet(exIdx, setIdx, 'type', type); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 18, width: '100%',
              padding: '15px 20px', background: 'none', border: 'none',
              borderBottom: '1px solid var(--border)', cursor: 'pointer',
            }}>
            <span style={{
              width: 34, height: 34, borderRadius: 8, background: bg, color,
              fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {type === 'N' ? '1' : type}
            </span>
            <span style={{ fontSize: 16, color: 'var(--text)' }}>{label}</span>
          </button>
        ))}
        <button
          onClick={() => { removeSet(exIdx, setIdx); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 18, width: '100%',
            padding: '15px 20px', background: 'none', border: 'none', cursor: 'pointer',
          }}>
          <span style={{
            width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--failure)',
            fontWeight: 800, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>✕</span>
          <span style={{ fontSize: 16, color: 'var(--failure)' }}>Remove Set</span>
        </button>
        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </div>
  );
}

// ── RIR / RPE Sheet ───────────────────────────────────────────────────────────
// Tapping a value commits it and closes immediately — no confirm step. A typed value
// commits on Enter/blur. Tapping the already-selected value clears it.
export function RirRpeSheet({ exIdx, setIdx, mode, onClose }) {
  const { session, updateSet } = useWorkout();
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose); // Back closes the sheet, not the app
  const ex = session.exercises[exIdx];
  const set = ex?.sets[setIdx];
  const options = mode === 'rpe' ? [6, 7, 7.5, 8, 8.5, 9, 9.5, 10] : [0, 1, 2, 3, 4, 5];
  const field = mode === 'rpe' ? 'rpe' : 'rir';
  const current = set?.[field] ?? null;
  const [typing, setTyping] = useState(false);
  const [typedVal, setTypedVal] = useState('');

  if (!ex || !set) return null;

  function pick(v) {
    updateSet(exIdx, setIdx, field, current === v ? null : v);
    onClose();
  }

  function commitTyped() {
    const n = parseFloat(typedVal);
    if (!isNaN(n)) { updateSet(exIdx, setIdx, field, n); onClose(); }
    else setTyping(false);
  }

  return (
    <div style={{ ...styles.sheetBackdrop, display: 'flex' }} onClick={onClose}>
      <div style={styles.sheetPanelAuto} ref={panelRef} {...zoneProps} onClick={e => e.stopPropagation()}>
        <div style={styles.sheetHandle} {...handleProps} />
        <div style={{ textAlign: 'center', padding: '18px 20px 4px', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
          Log Set {mode.toUpperCase()}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', paddingBottom: 8 }}>
          Set {setIdx + 1}: {set.weight || 0}{ex.units} × {set.reps || 0} reps
        </div>

        {typing ? (
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={typedVal}
            onChange={e => setTypedVal(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={e => { if (e.key === 'Enter') commitTyped(); }}
            style={{
              display: 'block', width: '100%', padding: '4px 20px',
              fontSize: 64, fontWeight: 800, textAlign: 'center', lineHeight: 1,
              background: 'none', border: 'none', borderBottom: '2px solid var(--accent)',
              color: 'var(--text)', outline: 'none',
            }}
          />
        ) : (
          <div
            onClick={() => { setTypedVal(current != null ? String(current) : ''); setTyping(true); }}
            style={{ fontSize: 64, fontWeight: 800, textAlign: 'center', padding: '4px 0', color: 'var(--text)', lineHeight: 1, cursor: 'text' }}
          >
            {current ?? '—'}
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '6px 0 16px' }}>
          {typing ? 'Type a value to log it' : 'Tap a value to log it · tap number above to type'}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 20px', overflowX: 'auto', justifyContent: 'center' }}>
          {options.map(v => (
            <button key={v} onClick={() => pick(v)}
              style={{
                flexShrink: 0, minWidth: 52, padding: '13px 6px', borderRadius: 12,
                background: current === v ? 'var(--accent)' : 'var(--bg3)',
                color: current === v ? '#fff' : 'var(--text)',
                border: 'none', fontSize: 17, fontWeight: 700, cursor: 'pointer',
              }}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </div>
  );
}

// ── Workout Settings Sheet ────────────────────────────────────────────────────
export function WorkoutSettingsSheet({ onClose }) {
  const { session, workoutSettings, setWorkoutSettings, setAllUnits, saveAsRoutine } = useWorkout();
  const { settings, updateSetting } = useApp();
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose); // Back closes the sheet, not the app
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // The session's unit, falling back to the global default.
  const units = session?.exercises?.[0]?.units ?? settings.units ?? 'kg';

  function changeUnits(v) {
    setAllUnits(v);
    updateSetting('units', v);
  }

  async function handleSaveRoutine() {
    setSavingRoutine(true);
    try {
      await saveAsRoutine(routineName);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } finally {
      setSavingRoutine(false);
    }
  }

  return (
    <>
      <div style={{ ...styles.sheetBackdrop, display: 'flex' }} onClick={onClose}>
        <div style={styles.sheetPanelAuto} ref={panelRef} {...zoneProps} onClick={e => e.stopPropagation()}>
          <div style={styles.sheetHandle} {...handleProps} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Workout Settings</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>

          {/* Weight Units */}
          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Weight Units</span>
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 2, gap: 2 }}>
              {['kg', 'lbs'].map(u => (
                <button key={u}
                  onClick={() => changeUnits(u)}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 14,
                    background: units === u ? 'var(--accent)' : 'transparent',
                    color: units === u ? '#fff' : 'var(--text2)',
                  }}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Default Rest Timer */}
          <button
            onClick={() => setShowRestPicker(true)}
            style={{ ...styles.settingsRow, cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left' }}>
            <span style={styles.settingsLabel}>Default Rest Timer</span>
            <span style={styles.settingsValue}>
              {workoutSettings.defaultRestTime ? `${workoutSettings.defaultRestTime}s` : 'Off'} ›
            </span>
          </button>

          {/* Intensity Tracking toggle */}
          <div style={{ padding: '14px 20px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Intensity Tracking
            </div>
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 3, gap: 3 }}>
              {['none', 'rir', 'rpe'].map(mode => (
                <button key={mode}
                  onClick={() => setWorkoutSettings('intensityMode', mode)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: workoutSettings.intensityMode === mode ? 'var(--accent)' : 'transparent',
                    color: workoutSettings.intensityMode === mode ? '#fff' : 'var(--text2)',
                    fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                  }}>
                  {mode === 'none' ? 'None' : mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Save as Routine */}
          <div style={{ padding: '4px 20px 20px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', margin: '14px 0 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Save as Routine
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={routineName}
                onChange={e => setRoutineName(e.target.value)}
                placeholder={session?.title || 'Routine name'}
                style={{
                  flex: 1, minWidth: 0, background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text)', fontSize: 16, padding: '10px 12px', outline: 'none',
                }}
              />
              <button
                onClick={handleSaveRoutine}
                disabled={savingRoutine || !(session?.exercises?.length)}
                style={{
                  flexShrink: 0, background: 'var(--accent)', border: 'none', borderRadius: 10,
                  color: '#fff', fontSize: 14, fontWeight: 700, padding: '0 18px', cursor: 'pointer',
                  opacity: savingRoutine || !(session?.exercises?.length) ? 0.5 : 1,
                }}>
                {savingRoutine ? 'Saving…' : 'Save'}
              </button>
            </div>
            {savedMsg && (
              <div style={{ fontSize: 13, color: 'var(--pr-green, #22c55e)', marginTop: 8 }}>
                Saved to My Routines ✓
              </div>
            )}
          </div>
          <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
        </div>
      </div>

      {showRestPicker && (
        <RestTimeModal
          currentRest={workoutSettings.defaultRestTime}
          defaultRest={settings.defaultRest ?? 90}
          onSave={secs => setWorkoutSettings('defaultRestTime', secs)}
          onClose={() => setShowRestPicker(false)}
        />
      )}
    </>
  );
}
