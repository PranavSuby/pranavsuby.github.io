import { useState, useEffect } from 'react';
import { Play, Plus, Dumbbell } from 'lucide-react';
import { getAllWorkouts } from '../db';

export default function Home({ onStartWorkout, onNewWorkout }) {
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    getAllWorkouts().then(setWorkouts);
  }, []);

  return (
    <div className="page">
      <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Start Workout</div>
        <button className="btn-icon" onClick={onNewWorkout} title="New workout">
          <Plus size={16} />
        </button>
      </div>

      {workouts.length === 0 ? (
        <div className="card" style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          <Dumbbell size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>No workouts yet — tap + to create one</div>
        </div>
      ) : (
        workouts.map(w => (
          <div key={w.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '12px 16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
              <div className="text-muted text-sm">{w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13, gap: 6 }} onClick={() => onStartWorkout(w)}>
              <Play size={14} /> Start
            </button>
          </div>
        ))
      )}
    </div>
  );
}
