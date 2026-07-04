import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { fmtDuration, fmtTimeOfDay } from '../../utils/format';
import { calcVolume, calcSets } from '../../utils/stats';
import { fmtVol } from './helpers';

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '12px 16px', background: 'none', border: 'none',
  color: 'var(--text)', fontSize: 14, cursor: 'pointer',
  borderBottom: '1px solid var(--border)',
};

// ── SessionCard ────────────────────────────────────────────────────────────────
export function SessionCard({ session, onDelete, onCopy, onEdit }) {
  const { settings } = useApp();
  const units = settings?.units ?? 'kg';
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const longPressTimer = useRef(null);
  const menuRef = useRef(null);

  const volume = calcVolume(session.exercises || []);
  const sets   = calcSets(session.exercises || []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  const handleLongPressStart = () => { longPressTimer.current = setTimeout(() => setMenuOpen(true), 500); };
  const handleLongPressEnd   = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  return (
    <div
      style={{ background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 10, overflow: 'hidden', position: 'relative' }}
      onMouseDown={handleLongPressStart} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
      onTouchStart={handleLongPressStart} onTouchEnd={handleLongPressEnd}
    >
      <div style={{ padding: '14px 14px 10px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>{session.title || 'Workout'}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtTimeOfDay(session.date)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); setConfirmDelete(false); }}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 0 0 8px', display: 'flex', alignItems: 'center' }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          {[
            { label: 'Duration', value: fmtDuration(session.duration) },
            { label: 'Volume',   value: fmtVol(volume, units) },
            { label: 'Sets',     value: String(sets) },
            ...(session.estimatedKcal != null ? [{ label: 'Calories', value: `${session.estimatedKcal} kcal` }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          {expanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {!(session.exercises || []).some(ex => (ex.sets || []).some(s => s.completed)) && (
            <div style={{ fontSize: 13, color: 'var(--text3)', paddingTop: 12 }}>
              No completed sets in this workout.
            </div>
          )}
          {(session.exercises || []).map((ex, i) => {
            const done = (ex.sets || []).filter(s => s.completed);
            if (!done.length) return null;
            return (
              <div key={i} style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{ex.name}</div>
                {done.map((set, j) => (
                  <div key={j} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8, marginBottom: 2, display: 'flex', gap: 10 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 18 }}>{j + 1}</span>
                    {set.time > 0 && !set.reps
                      ? <span>{set.time}s</span>
                      : <span>{set.reps} reps{+set.weight > 0 ? ` @ ${set.weight}${ex.units || units}` : ''}</span>
                    }
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {menuOpen && (
        <div ref={menuRef} style={{ position: 'absolute', top: 36, right: 10, zIndex: 50, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', minWidth: 160, boxShadow: '0 6px 24px rgba(0,0,0,0.45)' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(session); setMenuOpen(false); }} style={menuItemStyle}>
            Edit Workout
          </button>
          <button onClick={(e) => { e.stopPropagation(); onCopy(session); setMenuOpen(false); }} style={menuItemStyle}>
            Copy Workout
          </button>
          {!confirmDelete ? (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} style={{ ...menuItemStyle, color: 'var(--failure)' }}>
              Delete
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onDelete(session.id); setMenuOpen(false); }} style={{ ...menuItemStyle, color: 'var(--failure)', fontWeight: 700 }}>
              Confirm Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
