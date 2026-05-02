import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Dumbbell } from 'lucide-react';
import { fetchExercisesByBodyPart, fetchExercisesByName } from '../api';
import { getAllCustomExercises, saveExercise, deleteExercise } from '../db';
import ExerciseDetail from './ExerciseDetail';
import CreateExerciseModal from './CreateExerciseModal';

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const BODY_PARTS = [
  'All', 'chest', 'shoulders', 'biceps', 'triceps', 'forearms',
  'lats', 'middle back', 'lower back', 'traps',
  'quadriceps', 'hamstrings', 'glutes', 'calves',
  'abdominals', 'abductors', 'adductors', 'neck',
];

export default function ExerciseLibrary({ onPickExercise }) {
  const [exercises, setExercises] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeBodyPart, setActiveBodyPart] = useState('All');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadCustom = useCallback(async () => {
    const custom = await getAllCustomExercises();
    setCustomExercises(custom);
  }, []);

  useEffect(() => { loadCustom(); }, [loadCustom]);

  useEffect(() => {
    if (query.length > 1) {
      const t = setTimeout(async () => {
        setLoading(true);
        try { setExercises(await fetchExercisesByName(query)); }
        finally { setLoading(false); }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [query]);

  useEffect(() => {
    if (query.length > 1) return;
    setLoading(true);
    fetchExercisesByBodyPart(activeBodyPart === 'All' ? null : activeBodyPart)
      .then(setExercises)
      .finally(() => setLoading(false));
  }, [activeBodyPart, query]);

  const handleSaveCustom = async (ex) => {
    await saveExercise(ex);
    await loadCustom();
    setShowCreate(false);
  };

  const handleDeleteCustom = async (id) => {
    await deleteExercise(id);
    await loadCustom();
  };

  const handleRowClick = (ex) => {
    if (onPickExercise) {
      onPickExercise(ex);
    } else {
      setSelected(ex);
    }
  };

  const displayed = query.length > 1
    ? [...customExercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase())), ...exercises]
    : [...customExercises.filter(e => activeBodyPart === 'All' || e.bodyPart === activeBodyPart), ...exercises];

  return (
    <div className="page">
      <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
        <h1 className="page-title">Exercises</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          type="search"
          placeholder="Search exercises..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {query.length <= 1 && (
        <div className="chips-row">
          {BODY_PARTS.map(bp => (
            <button key={bp} className={`chip-btn ${activeBodyPart === bp ? 'active' : ''}`} onClick={() => setActiveBodyPart(bp)}>
              {cap(bp)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <Search size={40} />
          <p>No exercises found</p>
        </div>
      ) : (
        displayed.map(ex => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            onClick={() => handleRowClick(ex)}
            onViewDetail={onPickExercise ? () => setSelected(ex) : null}
            onDelete={ex.custom ? () => handleDeleteCustom(ex.id) : null}
            pickMode={!!onPickExercise}
          />
        ))
      )}

      {selected && (
        <ExerciseDetail
          exercise={selected}
          onClose={() => setSelected(null)}
          onPick={onPickExercise ? () => { onPickExercise(selected); setSelected(null); } : null}
        />
      )}

      {showCreate && (
        <CreateExerciseModal onSave={handleSaveCustom} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function ExerciseRow({ exercise, onClick, onViewDetail, onDelete, pickMode }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="exercise-row" onClick={onClick}>
      {exercise.imageUrl && !exercise.custom && !imgError ? (
        <img
          src={exercise.imageUrl}
          alt={exercise.name}
          className="exercise-thumb"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="exercise-thumb-placeholder">
          <Dumbbell size={18} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {exercise.name}
          {exercise.custom && (
            <span className="chip chip-accent" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}>Custom</span>
          )}
        </div>
        <div className="text-muted text-sm" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {exercise.bodyPart && <span>{cap(exercise.bodyPart)}</span>}
          {exercise.equipment && <span>· {cap(exercise.equipment)}</span>}
          <span style={{ color: 'var(--text3)' }}>· {exercise.trackingType === 'time' ? 'Timed' : 'Reps'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {onDelete && (
          <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={onDelete}>
            <X size={14} />
          </button>
        )}
        {pickMode && onViewDetail && (
          <button className="btn-icon" style={{ fontSize: 11, color: 'var(--text3)' }} onClick={onViewDetail} title="View details">
            <Search size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
