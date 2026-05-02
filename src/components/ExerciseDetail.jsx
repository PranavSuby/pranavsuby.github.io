// ExerciseDetail.jsx
import { X, Plus } from 'lucide-react';

export default function ExerciseDetail({ exercise, onClose, onPick }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {exercise.gifUrl && !exercise.custom && (
          <img src={exercise.gifUrl} alt={exercise.name} className="exercise-gif" style={{ marginBottom: 16 }} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h2 className="modal-title" style={{ marginBottom: 0, flex: 1, paddingRight: 8 }}>{exercise.name}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {exercise.bodyPart && <span className="chip">{exercise.bodyPart}</span>}
          {exercise.target && <span className="chip chip-accent">{exercise.target}</span>}
          {exercise.equipment && <span className="chip">{exercise.equipment}</span>}
          <span className="chip" style={{ color: exercise.trackingType === 'time' ? 'var(--accent2)' : 'var(--text2)' }}>
            {exercise.trackingType === 'time' ? '⏱ Timed' : '🔢 Reps + Weight'}
          </span>
        </div>

        {exercise.secondaryMuscles?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Secondary Muscles</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {exercise.secondaryMuscles.map((m, i) => <span key={i} className="chip" style={{ fontSize: 12 }}>{m}</span>)}
            </div>
          </div>
        )}

        {exercise.instructions?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Instructions</div>
            <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exercise.instructions.map((step, i) => (
                <li key={i} style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>{step}</li>
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
