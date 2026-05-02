// CreateExerciseModal.jsx
import { useState } from 'react';
import { X } from 'lucide-react';

const BODY_PARTS = ['chest', 'back', 'shoulders', 'upper arms', 'lower arms', 'upper legs', 'lower legs', 'waist', 'cardio', 'neck', 'other'];

export default function CreateExerciseModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [bodyPart, setBodyPart] = useState('chest');
  const [equipment, setEquipment] = useState('');
  const [trackingType, setTrackingType] = useState('reps');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    const exercise = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      bodyPart,
      equipment: equipment.trim(),
      trackingType,
      instructions: notes ? [notes] : [],
      secondaryMuscles: [],
      custom: true,
      imageUrl: null,
    };
    onSave(exercise);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="modal-title" style={{ marginBottom: 0 }}>New Exercise</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="section-label">Exercise Name *</div>
            <input placeholder="e.g. Bulgarian Split Squat" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <div className="section-label">Body Part</div>
            <select value={bodyPart} onChange={e => setBodyPart(e.target.value)}>
              {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp.charAt(0).toUpperCase() + bp.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <div className="section-label">Equipment (optional)</div>
            <input placeholder="e.g. Barbell, Dumbbell, Bodyweight" value={equipment} onChange={e => setEquipment(e.target.value)} />
          </div>

          <div>
            <div className="section-label">Tracking Type</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-full ${trackingType === 'reps' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTrackingType('reps')}
              >Reps + Weight</button>
              <button
                className={`btn btn-full ${trackingType === 'time' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTrackingType('time')}
              >Time + Weight</button>
            </div>
          </div>

          <div>
            <div className="section-label">Notes (optional)</div>
            <textarea placeholder="Form cues, tips..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : 0.5 }}>
            Save Exercise
          </button>
        </div>
      </div>
    </div>
  );
}
