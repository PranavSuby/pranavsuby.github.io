import { useState, useEffect } from 'react';
import { ChevronRight, Clock, Dumbbell } from 'lucide-react';
import { getAllSessions } from '../db';

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Metrics() {
  const [sessions, setSessions] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [expandedSession, setExpandedSession] = useState(null);

  useEffect(() => { getAllSessions().then(setSessions); }, []);

  if (sessions.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Metrics</h1>
        <div className="empty-state">
          <Dumbbell size={40} />
          <p>No sessions logged yet</p>
          <p className="text-sm">Complete a workout to see your stats</p>
        </div>
      </div>
    );
  }

  // Body part focus
  const bodyPartCounts = {};
  let totalSets = 0;
  sessions.forEach(s => {
    s.exercises?.forEach(ex => {
      const bp = ex.bodyPart || 'other';
      const sets = ex.sets?.filter(s => s.completed).length || 0;
      bodyPartCounts[bp] = (bodyPartCounts[bp] || 0) + sets;
      totalSets += sets;
    });
  });
  const sortedBodyParts = Object.entries(bodyPartCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // All unique exercise names across sessions
  const exerciseNames = [...new Set(
    sessions.flatMap(s => s.exercises?.map(e => e.name) || [])
  )].sort();

  // Progression data for selected exercise
  const progressionData = selectedExercise
    ? sessions
        .filter(s => s.exercises?.some(e => e.name === selectedExercise))
        .map(s => {
          const ex = s.exercises.find(e => e.name === selectedExercise);
          const completedSets = ex.sets?.filter(s => s.completed) || [];
          const maxWeight = Math.max(0, ...completedSets.map(s => parseFloat(s.weight) || 0));
          const totalReps = completedSets.reduce((a, s) => a + (parseInt(s.reps) || 0), 0);
          const totalTime = completedSets.reduce((a, s) => a + (parseInt(s.time) || 0), 0);
          return { date: s.date, maxWeight, totalReps, totalTime, sets: completedSets.length, trackingType: ex.trackingType };
        })
        .reverse()
    : [];

  return (
    <div className="page">
      <h1 className="page-title">Metrics</h1>

      {/* Muscle Focus */}
      <div className="section-label">Muscle Focus</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {sortedBodyParts.length === 0 ? (
          <div className="text-muted text-sm">No completed sets yet</div>
        ) : sortedBodyParts.map(([bp, count]) => (
          <div key={bp} style={{ marginBottom: 10 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{bp}</span>
              <span className="text-muted text-sm">{count} sets</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3 }}>
              <div style={{
                height: '100%',
                width: `${Math.round((count / sortedBodyParts[0][1]) * 100)}%`,
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Exercise Progression */}
      <div className="section-label">Exercise Progression</div>
      <div style={{ marginBottom: 12 }}>
        <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
          <option value="">Select an exercise…</option>
          {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {selectedExercise && progressionData.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 0 }}>
            {['Date', progressionData[0].trackingType === 'time' ? 'Time' : 'Reps', 'Weight', 'Sets'].map(h => (
              <div key={h} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</div>
            ))}
            {progressionData.map((row, i) => (
              <>
                <div key={`d${i}`} style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{fmtDate(row.date)}</div>
                <div key={`r${i}`} style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--accent)' }}>
                  {row.trackingType === 'time' ? `${row.totalTime}s` : row.totalReps}
                </div>
                <div key={`w${i}`} style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  {row.maxWeight > 0 ? `${row.maxWeight}kg` : '—'}
                </div>
                <div key={`s${i}`} style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                  {row.sets}
                </div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Session Timeline */}
      <div className="section-label">Session History</div>
      {sessions.map(s => {
        const completedSets = s.exercises?.reduce((a, e) => a + (e.sets?.filter(s => s.completed).length || 0), 0) || 0;
        const totalSetsCount = s.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0;
        const isExpanded = expandedSession === s.id;
        return (
          <div key={s.id} className="card" style={{ marginBottom: 8 }}>
            <div
              className="flex justify-between items-center"
              onClick={() => setExpandedSession(isExpanded ? null : s.id)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.workoutName}</div>
                <div className="text-muted text-sm" style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                  <span>{fmtDate(s.date)}</span>
                  <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtDuration(s.duration)}</span>
                  <span>{completedSets}/{totalSetsCount} sets</span>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text3)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>

            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {s.exercises?.map((ex, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{ex.name}</div>
                    {ex.sets?.map((set, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 2, opacity: set.completed ? 1 : 0.4 }}>
                        <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)' }}>{j + 1}</span>
                        {ex.trackingType === 'time'
                          ? <span>{set.time || 0}s {set.weight ? `@ ${set.weight}kg` : ''}</span>
                          : <span>{set.reps || 0} reps {set.weight ? `@ ${set.weight}kg` : ''}</span>
                        }
                        {set.completed && <span style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
