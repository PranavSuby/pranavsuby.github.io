import { useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { fmtDuration, fmtShortDate } from '../../utils/format';
import { calcSets } from '../../utils/stats';
import { useBackClose } from '../../ui';
import { DAY_LABELS, MONTH_NAMES } from './helpers';

// ── DayDetail overlay ─────────────────────────────────────────────────────────
function DayDetail({ date, sessions, onClose }) {
  useBackClose(onClose);
  const { settings } = useApp();
  const units = settings?.units ?? 'kg';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.22s ease-out' }}>
      <style>{`@keyframes slideUp { from { transform: translateY(32px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{fmtShortDate(date)}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {sessions.map((session) => {
          const sets = calcSets(session.exercises || []);
          return (
            <div key={session.id} style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{session.title || 'Workout'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{fmtDuration(session.duration)} · {sets} sets</div>
              {(session.exercises || []).map((ex, i) => {
                const done = (ex.sets || []).filter(s => s.completed);
                if (!done.length) return null;
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{ex.name}</div>
                    {done.map((set, j) => (
                      <div key={j} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8, marginBottom: 2, display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--text3)', minWidth: 18 }}>{j + 1}</span>
                        {set.time > 0 && !set.reps ? <span>{set.time}s</span> : <span>{set.reps} reps{+set.weight > 0 ? ` @ ${set.weight}${ex.units || units}` : ''}</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ sessions, onDayClick }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const sessionDates = new Map();
  for (const s of sessions) {
    const key = new Date(s.date).toLocaleDateString('en-CA');
    if (!sessionDates.has(key)) sessionDates.set(key, []);
    sessionDates.get(key).push(s);
  }

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() - 1); return n; });
  const nextMonth = () => setMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return n; });

  return (
    <div style={{ padding: '16px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{MONTH_NAMES[monthIdx]} {year}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const cellDate = new Date(year, monthIdx, day);
          cellDate.setHours(0, 0, 0, 0);
          const dateKey = cellDate.toLocaleDateString('en-CA');
          const hasSessions = sessionDates.has(dateKey);
          const isToday = cellDate.getTime() === today.getTime();

          return (
            <div
              key={day}
              onClick={() => hasSessions && onDayClick(cellDate.toISOString(), sessionDates.get(dateKey))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '10px 0 6px',
                borderRadius: 8,
                cursor: hasSessions ? 'pointer' : 'default',
                background: isToday ? 'var(--bg3)' : 'transparent',
                outline: isToday ? '1px solid var(--text3)' : 'none',
                outlineOffset: '-1px',
                gap: 3,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--text)' : 'var(--text2)' }}>
                {day}
              </span>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasSessions ? 'var(--accent)' : 'transparent' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CalendarView ──────────────────────────────────────────────────────────────
export function CalendarView({ sessions, onBack }) {
  useBackClose(onBack);
  const [expandedDay, setExpandedDay] = useState(null);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 16px) 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Calendar</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
        <Calendar sessions={sessions} onDayClick={(dateIso, daySessions) => setExpandedDay({ date: dateIso, sessions: daySessions })} />
      </div>
      {expandedDay && <DayDetail date={expandedDay.date} sessions={expandedDay.sessions} onClose={() => setExpandedDay(null)} />}
    </div>
  );
}
