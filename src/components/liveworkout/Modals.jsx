import { useState } from 'react';
import { styles } from './styles';

// ── Note Modal ────────────────────────────────────────────────────────────────
export function NoteModal({ currentNote, onSave, onClose }) {
  const [note, setNote] = useState(currentNote ?? '');
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Exercise Note</div>
        <textarea
          style={styles.noteTextarea}
          placeholder="Add a note for this exercise…"
          value={note}
          onChange={e => setNote(e.target.value)}
          autoFocus
          rows={4}
        />
        <div style={styles.modalActions}>
          <button style={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.modalSaveBtn} onClick={() => { onSave(note); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Rest Time Modal ───────────────────────────────────────────────────────────
export function RestTimeModal({ currentRest, defaultRest, onSave, onClose }) {
  const [secs, setSecs] = useState(currentRest ?? defaultRest ?? 90);
  const [typing, setTyping] = useState(false);
  const [typedVal, setTypedVal] = useState('');

  function commitTyped() {
    const n = parseInt(typedVal, 10);
    if (!isNaN(n)) setSecs(Math.max(0, Math.min(600, n)));
    setTyping(false);
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Rest Timer</div>
        <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>Override rest time for this exercise.</div>
        <div style={styles.restModalRow}>
          <button style={styles.restModalAdj} onClick={() => setSecs(s => Math.max(0, s - 15))}>−15</button>
          <div style={styles.restModalDisplay}>
            {typing ? (
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={typedVal}
                onChange={e => setTypedVal(e.target.value)}
                onBlur={commitTyped}
                onKeyDown={e => { if (e.key === 'Enter') commitTyped(); }}
                style={{
                  fontSize: 28, fontWeight: 700, color: 'var(--text)',
                  background: 'none', border: 'none', borderBottom: '2px solid var(--accent)',
                  outline: 'none', width: 80, textAlign: 'center', padding: '0 4px',
                }}
              />
            ) : (
              <span
                onClick={() => { setTypedVal(String(secs)); setTyping(true); }}
                style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', cursor: 'text' }}
              >
                {secs}
              </span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 4 }}>sec</span>
          </div>
          <button style={styles.restModalAdj} onClick={() => setSecs(s => Math.min(600, s + 15))}>+15</button>
        </div>
        <input type="range" min={0} max={600} step={5} value={secs}
          onChange={e => setSecs(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 20, accentColor: 'var(--accent)' }} />
        <div style={styles.modalActions}>
          <button style={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.modalSaveBtn} onClick={() => { onSave(secs); onClose(); }}>Set Timer</button>
        </div>
      </div>
    </div>
  );
}
