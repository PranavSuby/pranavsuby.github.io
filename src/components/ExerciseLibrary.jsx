import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, ChevronRight, X } from 'lucide-react';
import { fetchExercisesByBodyPart, fetchExercisesByName, normalizeApiExercise } from '../api';
import { getAllCustomExercises, saveExercise, deleteExercise } from '../db';
import ExerciseDetail from './ExerciseDetail';
import CreateExerciseModal from './CreateExerciseModal';

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
        try {
          const data = await fetchExercisesByName(query);
          setExercises(data);
        } finally { setLoading(false); }
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
              {bp.charAt(0).toUpperCase() + bp.slice(1)}
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
        displayed.map((ex) => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            onView={() => setSelected(ex)}
            onPick={onPickExercise ? () => onPickExercise(ex) : null}
            onDelete={ex.custom ? () => handleDeleteCustom(ex.id) : null}
          />
        ))
      )}

      {selected && (
        <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} onPick={onPickExercise ? () => { onPickExercise(selected); setSelected(null); } : null} />
      )}

      {showCreate && (
        <CreateExerciseModal onSave={handleSaveCustom} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function ExerciseRow({ exercise, onView, onPick, onDelete }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 8 }}>
      {exercise.gifUrl && !exercise.custom ? (
        <img src={exercise.gifUrl} alt={exercise.name} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', background: 'var(--bg3)', flexShrink: 0 }} loading="lazy" />
      ) : (
        <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          💪
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {exercise.name}
          {exercise.custom && <span className="chip chip-accent" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}>Custom</span>}
        </div>
        <div className="text-muted text-sm" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {exercise.bodyPart && <span>{exercise.bodyPart}</span>}
          {exercise.equipment && <span>· {exercise.equipment}</span>}
          <span style={{ color: exercise.trackingType === 'time' ? 'var(--accent2)' : 'var(--text3)' }}>· {exercise.trackingType === 'time' ? '⏱ Timed' : '🔢 Reps'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {onDelete && (
          <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={onDelete}>
            <X size={14} />
          </button>
        )}
        {onPick ? (
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onPick}>Add</button>
        ) : (
          <button className="btn-icon" onClick={onView}><ChevronRight size={18} /></button>
        )}
      </div>
    </div>
  );
}
