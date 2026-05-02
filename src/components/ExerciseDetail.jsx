import { useState } from 'react';
import { X, Plus, Dumbbell } from 'lucide-react';

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export default function ExerciseDetail({ exercise, onClose, onPick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="side-panel-overlay" onClick={onClose}>
      <div className="side-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 26, letterSpacing: 1, flex: 1, paddingRight: 8 }}>
            {exercise.name}
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {exercise.imageUrl && !exercise.custom && !imgError ? (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            className="exercise-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="exercise-img-placeholder">
            <Dumbbell size={32} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {exercise.bodyPart && <span className="chip">{cap(exercise.bodyPart)}</span>}
          {exercise.target && exercise.target !== exercise.bodyPart && (
            <span className="chip chip-accent">{cap(exercise.target)}</span>
          )}
          {exercise.equipment && <span className="chip">{cap(exercise.equipment)}</span>}
          <span className="chip">
            {exercise.trackingType === 'time' ? 'Timed' : 'Reps + Weight'}
          </span>
        </div>

        {exercise.secondaryMuscles?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Secondary Muscles</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {exercise.secondaryMuscles.map((m, i) => (
                <span key={i} className="chip" style={{ fontSize: 12 }}>{cap(m)}</span>
              ))}
            </div>
          </div>
        )}

        {exercise.instructions?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Instructions</div>
            <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {exercise.instructions.map((step, i) => (
                <li key={i} style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.65 }}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {onPick && (
          <button className="btn btn-primary btn-full" onClick={onPick}>
            <Plus size={16} /> Add to Workout
          </button>
        )}
      </div>
    </div>
  );
}
