import { useState, useEffect } from 'react';
import { Play, Plus, Clock, ChevronRight, Dumbbell } from 'lucide-react';
import { getAllWorkouts, getAllSessions, deleteSession } from '../db';

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Home({ onStartWorkout, onNewWorkout }) {
  const [workouts, setWorkouts] = useState([]);
  const [sessions, setSessions] = useState([]);

  const load = async () => {
    const [w, s] = await Promise.all([getAllWorkouts(), getAllSessions()]);
    setWorkouts(w);
    setSessions(s);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    await deleteSession(id);
    load();
  };

  return (
    <div className="page">
      {/* Start Workout */}
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

      {/* Session History */}
      <div className="divider" />
      <div className="section-label">Recent Sessions</div>

      {sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <p className="text-sm">No sessions logged yet</p>
        </div>
      ) : (
        sessions.slice(0, 15).map(s => (
          <SessionCard key={s.id} session={s} onDelete={() => handleDelete(s.id)} />
        ))
      )}
    </div>
  );
}

function SessionCard({ session, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const totalSets = session.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0;
  const completedSets = session.exercises?.reduce((a, e) => a + (e.sets?.filter(s => s.completed).length || 0), 0) || 0;

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div className="flex justify-between items-center" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{session.workoutName}</div>
          <div className="text-muted text-sm" style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
            <span>{fmtDate(session.date)}</span>
            <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtDuration(session.duration)}</span>
            <span>{completedSets}/{totalSets} sets</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={e => { e.stopPropagation(); onDelete(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
          <ChevronRight size={18} color="var(--text3)" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {session.exercises?.map((ex, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{ex.name}</div>
              {ex.sets?.map((s, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 2, opacity: s.completed ? 1 : 0.4 }}>
                  <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)' }}>{j + 1}</span>
                  {ex.trackingType === 'time'
                    ? <span>{s.time || 0}s {s.weight ? `@ ${s.weight}kg` : ''}</span>
                    : <span>{s.reps || 0} reps {s.weight ? `@ ${s.weight}kg` : ''}</span>
                  }
                  {s.completed && <span style={{ color: 'var(--accent)', fontSize: 11 }}>Done</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
