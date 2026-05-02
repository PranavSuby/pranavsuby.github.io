// Home.jsx
import { useState, useEffect } from 'react';
import { Play, Clock, ChevronRight, Trash2, Dumbbell } from 'lucide-react';
import { getAllWorkouts, getAllSessions, deleteSession } from '../db';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Home({ onStartWorkout }) {
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

  // Streak calc
  const streak = calcStreak(sessions);

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard label="Streak" value={`${streak}d`} accent />
        <StatCard label="Sessions" value={sessions.length} />
        <StatCard label="Workouts" value={workouts.length} />
      </div>

      {/* Start a workout */}
      <div className="section-label">Start Workout</div>
      {workouts.length === 0 ? (
        <div className="card" style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          <Dumbbell size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>No workouts yet — create one in the Workouts tab</div>
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

      {/* History */}
      <div className="divider" />
      <div className="section-label">Recent Sessions</div>

      {sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <p className="text-sm">No sessions logged yet</p>
        </div>
      ) : (
        sessions.slice(0, 20).map(s => (
          <SessionCard key={s.id} session={s} onDelete={() => handleDelete(s.id)} />
        ))
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div className="text-xs text-muted" style={{ marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
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
          <div className="text-muted text-sm" style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <span>{fmtDate(session.date)}</span>
            <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtDuration(session.duration)}</span>
            <span>{completedSets}/{totalSets} sets</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-icon" style={{ color: 'var(--accent2)' }} onClick={e => { e.stopPropagation(); onDelete(); }}><Trash2 size={14} /></button>
          <ChevronRight size={18} color="var(--text3)" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {session.exercises?.map((ex, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{ex.name}</div>
              {ex.sets?.map((s, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 2, opacity: s.completed ? 1 : 0.5 }}>
                  <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)' }}>{j + 1}</span>
                  {ex.trackingType === 'time'
                    ? <span>{s.time || 0}s {s.weight ? `@ ${s.weight}kg` : ''}</span>
                    : <span>{s.reps || 0} reps {s.weight ? `@ ${s.weight}kg` : ''}</span>
                  }
                  {s.completed && <span style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => s.date.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let check = new Date();
  check.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const sessionDate = new Date(d);
    const diff = Math.round((check - sessionDate) / 86400000);
    if (diff <= 1) { streak++; check = sessionDate; }
    else break;
  }
  return streak;
}
