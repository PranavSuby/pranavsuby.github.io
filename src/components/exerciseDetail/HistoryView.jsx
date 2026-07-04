import { Dumbbell } from 'lucide-react';
import { fmtShortDate } from '../../utils/format';
import { SURFACE, BORDER, TEXT1, TEXT2, TEXT3 } from './theme';

// ─── HistoryTab ───────────────────────────────────────────────────────────────
export function HistoryTab({ exercise, sessions }) {
  if (sessions.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '48px 0',
          color: TEXT3,
        }}
      >
        <Dumbbell size={36} color={TEXT3} />
        <div style={{ fontSize: 14, color: TEXT2, fontWeight: 600 }}>No history yet</div>
        <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 220 }}>
          Log this exercise in a workout to see your history here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {sessions.map(session => {
        const ex = session.exercises?.find(e => e.name === exercise.name);
        if (!ex) return null;
        const completedSets = ex.sets?.filter(s => s.completed) || [];
        const isTimeBased   = exercise.trackingType === 'time' || ex.trackingType === 'time';

        return (
          <div
            key={session.id}
            style={{
              borderBottom: `1px solid ${BORDER}`,
              padding: '14px 0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: TEXT1 }}>
                {session.title || 'Workout'}
              </span>
              <span style={{ fontSize: 12, color: TEXT3 }}>
                {session.date ? fmtShortDate(session.date) : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {completedSets.length === 0 && (
                <span style={{ fontSize: 13, color: TEXT3 }}>No completed sets</span>
              )}
              {completedSets.map((set, i) => {
                let label;
                if (isTimeBased) {
                  label = set.time ? `${set.time}s` : '—';
                } else {
                  const reps   = set.reps   ? `${set.reps} reps`   : '';
                  const weight = set.weight ? `${set.weight} ${ex.units || 'kg'}` : '';
                  label = [weight, reps].filter(Boolean).join(' × ');
                }
                return (
                  <span
                    key={i}
                    style={{
                      fontSize: 13,
                      color: TEXT2,
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: '3px 9px',
                    }}
                  >
                    {label || '—'}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
