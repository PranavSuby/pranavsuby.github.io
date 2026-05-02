import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Dumbbell, Clock } from 'lucide-react';
import { getAllSessions } from '../db';

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Metrics() {
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('calendar');

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

  return (
    <div className="page">
      <h1 className="page-title">Metrics</h1>

      <div className="metrics-tabs">
        {[['calendar', 'Calendar'], ['focus', 'Muscle Focus'], ['progress', 'Progress']].map(([id, label]) => (
          <button key={id} className={`metrics-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && <CalendarTab sessions={sessions} />}
      {activeTab === 'focus' && <FocusTab sessions={sessions} />}
      {activeTab === 'progress' && <ProgressTab sessions={sessions} />}
    </div>
  );
}

function CalendarTab({ sessions }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedDay, setExpandedDay] = useState(null);

  const sessionsByDate = {};
  sessions.forEach(s => {
    const key = s.date.slice(0, 10);
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    sessionsByDate[key].push(s);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <>
      <div className="cal-nav">
        <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{MONTH_NAMES[month]} {year}</span>
        <button className="btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
      </div>

      <div className="cal-grid" style={{ marginBottom: 8 }}>
        {DAY_LABELS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const hasSessions = !!sessionsByDate[dateKey];
          const isToday = dateKey === today;
          return (
            <div
              key={dateKey}
              className={`cal-day ${hasSessions ? 'has-session' : ''} ${isToday ? 'today' : ''}`}
              onClick={hasSessions ? () => setExpandedDay(dateKey) : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>

      {expandedDay && (
        <DayOverlay
          date={expandedDay}
          sessions={sessionsByDate[expandedDay] || []}
          onClose={() => setExpandedDay(null)}
        />
      )}
    </>
  );
}

function DayOverlay({ date, sessions, onClose }) {
  const d = new Date(date + 'T12:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="day-overlay">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={onClose}><ArrowLeft size={18} /></button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{label}</div>
          <div className="text-muted text-sm">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sessions.map((s, i) => {
        const completedSets = s.exercises?.reduce((a, e) => a + (e.sets?.filter(s => s.completed).length || 0), 0) || 0;
        const totalSets = s.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0;
        return (
          <div key={i} className="card" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{s.workoutName}</div>
              <div className="text-muted text-sm" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtDuration(s.duration)}</span>
                <span>{completedSets}/{totalSets} sets completed</span>
              </div>
            </div>

            {s.exercises?.map((ex, ei) => (
              <div key={ei} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>{ex.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 72px 72px auto', gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', fontWeight: 600 }}>Set</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', fontWeight: 600 }}>
                    {ex.trackingType === 'time' ? 'Time' : 'Reps'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', fontWeight: 600 }}>Weight</div>
                  <div />
                </div>
                {ex.sets?.map((set, si) => (
                  <div key={si} style={{ display: 'grid', gridTemplateColumns: '28px 72px 72px auto', gap: 6, marginBottom: 4, opacity: set.completed ? 1 : 0.4 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>{si + 1}</div>
                    <div style={{ fontSize: 13, textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                      {ex.trackingType === 'time' ? `${set.time || 0}s` : (set.reps || '—')}
                    </div>
                    <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--text2)' }}>
                      {set.weight ? `${set.weight} kg` : '—'}
                    </div>
                    {set.completed && <div style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>Done</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FocusTab({ sessions }) {
  const bodyPartCounts = {};
  sessions.forEach(s => {
    s.exercises?.forEach(ex => {
      const bp = ex.bodyPart || 'other';
      const sets = ex.sets?.filter(s => s.completed).length || 0;
      bodyPartCounts[bp] = (bodyPartCounts[bp] || 0) + sets;
    });
  });

  const sorted = Object.entries(bodyPartCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (sorted.length === 0) return <div className="empty-state"><p className="text-sm">Complete some sets to see muscle focus</p></div>;

  return (
    <div className="card">
      {sorted.map(([bp, count]) => (
        <div key={bp} style={{ marginBottom: 14 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 13 }}>{cap(bp)}</span>
            <span className="text-muted text-sm">{count} sets</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              width: `${Math.round((count / sorted[0][1]) * 100)}%`,
              background: 'var(--accent)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressTab({ sessions }) {
  const exerciseNames = [...new Set(sessions.flatMap(s => s.exercises?.map(e => e.name) || []))].sort();
  const [selectedExercise, setSelectedExercise] = useState('');

  const rows = selectedExercise
    ? sessions
        .filter(s => s.exercises?.some(e => e.name === selectedExercise))
        .map(s => {
          const ex = s.exercises.find(e => e.name === selectedExercise);
          const done = ex.sets?.filter(s => s.completed) || [];
          const maxWeight = Math.max(0, ...done.map(s => parseFloat(s.weight) || 0));
          const totalReps = done.reduce((a, s) => a + (parseInt(s.reps) || 0), 0);
          const totalTime = done.reduce((a, s) => a + (parseInt(s.time) || 0), 0);
          return { date: s.date, maxWeight, totalReps, totalTime, sets: done.length, trackingType: ex.trackingType };
        })
        .reverse()
    : [];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
          <option value="">Select an exercise...</option>
          {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {selectedExercise && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 72px 40px', borderBottom: '1px solid var(--border)' }}>
            {['Date', rows[0].trackingType === 'time' ? 'Time' : 'Reps', 'Max Weight', 'Sets'].map(h => (
              <div key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)' }}>{h}</div>
            ))}
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 72px 40px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '10px 12px', fontSize: 13 }}>{fmtDate(row.date)}</div>
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>
                {row.trackingType === 'time' ? `${row.totalTime}s` : row.totalReps}
              </div>
              <div style={{ padding: '10px 12px', fontSize: 13, textAlign: 'center' }}>
                {row.maxWeight > 0 ? `${row.maxWeight} kg` : '—'}
              </div>
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
                {row.sets}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedExercise && rows.length === 0 && (
        <div className="empty-state"><p className="text-sm">No completed sets for this exercise yet</p></div>
      )}
    </>
  );
}
