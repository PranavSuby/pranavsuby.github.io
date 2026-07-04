import { useState, useEffect, useRef } from 'react';
import { Play, Pencil, Trash2, MoreVertical, Copy } from 'lucide-react';
import { fmtDate } from '../../utils/format';
import { styles } from './styles';

// ── RoutineCard ───────────────────────────────────────────────────────────────
export function RoutineCard({ routine, lastDate, onStart, onEdit, onDelete, onDuplicate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef(null);

  const exerciseCount = routine.exercises?.length ?? 0;
  const chips = (routine.exercises ?? []).slice(0, 4);
  const lastLabel = lastDate ? fmtDate(lastDate) : 'Never';

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [menuOpen]);

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setMenuOpen(false);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div style={styles.routineCard}>
      {/* Three-dot menu */}
      <div ref={menuRef} style={styles.menuWrap}>
        <button
          style={styles.iconBtn}
          onClick={e => {
            e.stopPropagation();
            setMenuOpen(o => !o);
            setConfirmDelete(false);
          }}
          aria-label="More options"
        >
          <MoreVertical size={16} color="var(--text2)" />
        </button>
        {menuOpen && (
          <div style={styles.dropMenu}>
            {confirmDelete ? (
              <div style={{ padding: '8px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--failure)', marginBottom: 8 }}>
                  Delete this routine?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={styles.confirmBtn} onClick={handleDeleteClick}>
                    Delete
                  </button>
                  <button
                    style={styles.cancelBtn}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button style={styles.menuItem} onClick={() => { setMenuOpen(false); onDuplicate?.(); }}>
                  <Copy size={14} color="var(--text2)" />
                  <span>Duplicate</span>
                </button>
                <button style={styles.menuItem} onClick={handleDeleteClick}>
                  <Trash2 size={14} color="var(--failure)" />
                  <span style={{ color: 'var(--failure)' }}>Delete</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={styles.routineTitle}>{routine.title || 'Untitled Routine'}</div>
      <div style={styles.routineSub}>
        {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} · Last:{' '}
        {lastLabel}
      </div>

      {chips.length > 0 && (
        <div style={styles.chipsRow}>
          {chips.map((ex, i) => (
            <span key={i} style={styles.chip}>
              {ex.name}
            </span>
          ))}
          {(routine.exercises?.length ?? 0) > 4 && (
            <span style={styles.chipMore}>
              +{routine.exercises.length - 4}
            </span>
          )}
        </div>
      )}

      <div style={styles.cardActions}>
        <button style={styles.primaryBtn} onClick={onStart}>
          <Play size={14} style={{ marginRight: 5 }} />
          Start
        </button>
        <button style={styles.ghostBtn} onClick={onEdit}>
          <Pencil size={14} style={{ marginRight: 5 }} />
          Edit
        </button>
      </div>
    </div>
  );
}
