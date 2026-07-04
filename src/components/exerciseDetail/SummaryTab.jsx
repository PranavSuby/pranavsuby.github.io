import { Dumbbell, Trophy } from 'lucide-react';
import { getExercisePRs, exerciseUnit } from '../../utils/stats';
import { fmtShortDate } from '../../utils/format';
import { cap } from '../../utils/exercises';
import { getExerciseVideo, youtubeSearchUrl } from '../../utils/videos';
import {
  SURFACE, BORDER, ACCENT, ACCENT_DIM, TEXT1, TEXT2, TEXT3, PILL_BG, PR_COLOR,
} from './theme';

// reps we show in the Set Records table
const SET_REPS_ROWS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, highlight }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${highlight ? 'rgba(251,191,36,0.35)' : BORDER}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: highlight ? PR_COLOR : TEXT1 }}>
        {value}
      </span>
    </div>
  );
}

// ─── SummaryTab ───────────────────────────────────────────────────────────────
export function SummaryTab({ exercise, sessions }) {
  const prs = getExercisePRs(sessions, exercise.name);
  const unit = exerciseUnit(sessions, exercise.name);

  const instructions = exercise.instructions;
  const isTimeBased  = exercise.trackingType === 'time';
  const video        = getExerciseVideo(exercise);

  const fmt1RM = v => v > 0 ? `${Math.round(v)} ${unit}` : '—';
  const fmtKg  = v => v > 0 ? `${v} ${unit}` : '—';
  const fmtVol = v => {
    if (v <= 0) return '—';
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k ${unit}`;
    return `${Math.round(v)} ${unit}`;
  };
  const fmtReps = v => v > 0 ? `${v} reps` : '—';

  const setRecordRows = SET_REPS_ROWS.filter(r => prs.setRecords[r]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Image / placeholder */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4/3',
          borderRadius: 12,
          overflow: 'hidden',
          background: SURFACE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {exercise.imageUrl ? (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Dumbbell size={64} color={TEXT3} />
        )}
      </div>

      {/* Muscle badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {exercise.bodyPart && (
          <span
            style={{
              background: ACCENT_DIM,
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            {cap(exercise.bodyPart)}
          </span>
        )}
        {exercise.equipment && (
          <span
            style={{
              background: PILL_BG,
              border: `1px solid ${BORDER}`,
              color: TEXT2,
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {cap(exercise.equipment)}
          </span>
        )}
        {exercise.custom && (
          <span
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: PR_COLOR,
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            Custom
          </span>
        )}
      </div>

      {/* How-to video */}
      <div>
        <div style={{ fontSize: 13, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          How-to video
        </div>
        {video && (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: ACCENT_DIM, border: `1px solid ${ACCENT}`, borderRadius: 12,
              padding: '12px 14px', textDecoration: 'none', marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 18, color: ACCENT }}>▶</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {video.title || exercise.name}
              </span>
              {video.channel && (
                <span style={{ fontSize: 12, color: TEXT2 }}>{video.channel}</span>
              )}
            </span>
          </a>
        )}
        <a
          href={youtubeSearchUrl(exercise.name)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: '11px 14px', textDecoration: 'none', color: TEXT2,
            fontSize: 14, fontWeight: 600,
          }}
        >
          {video ? 'Find more videos on YouTube' : 'Search how-to videos on YouTube'}
        </a>
      </div>

      {/* Instructions */}
      {instructions && (
        <div>
          <div style={{ fontSize: 13, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Instructions
          </div>
          {Array.isArray(instructions) ? (
            <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {instructions.map((step, i) => (
                <li key={i} style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            instructions.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6, marginBottom: 4 }}>
                {para}
              </p>
            ))
          )}
        </div>
      )}

      {/* Records */}
      {sessions.length > 0 && (
        <>
          <div>
            <div style={{ fontSize: 13, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Personal Records
            </div>
            {isTimeBased ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCard label="Best Duration" value={prs.bestWeight > 0 ? `${prs.bestWeight}s` : '—'} highlight={prs.bestWeight > 0} />
                <StatCard label="Max Reps" value={fmtReps(prs.maxReps)} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCard label="Best Weight" value={fmtKg(prs.bestWeight)} highlight={prs.bestWeight > 0} />
                <StatCard label="Est. 1RM"    value={fmt1RM(prs.best1RM)}   highlight={prs.best1RM > 0}   />
                <StatCard label="Best Volume" value={fmtVol(prs.bestVolume)} />
                <StatCard label="Max Reps"    value={fmtReps(prs.maxReps)} />
              </div>
            )}
          </div>

          {setRecordRows.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Set Records
              </div>
              <div
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {/* header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '8px 14px',
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  {['Reps', 'Weight', 'Date'].map(h => (
                    <span key={h} style={{ fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </span>
                  ))}
                </div>
                {setRecordRows.map(reps => {
                  const rec = prs.setRecords[reps];
                  return (
                    <div
                      key={reps}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        padding: '9px 14px',
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <span style={{ fontSize: 14, color: TEXT2 }}>{reps}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: PR_COLOR }}>{rec.weight} {unit}</span>
                      <span style={{ fontSize: 12, color: TEXT3 }}>
                        {rec.date ? fmtShortDate(rec.date) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {sessions.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '32px 0',
            color: TEXT3,
          }}
        >
          <Trophy size={36} color={TEXT3} />
          <div style={{ fontSize: 14, color: TEXT2, fontWeight: 600 }}>No records yet</div>
          <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 220 }}>
            Complete workouts with this exercise to see your records here.
          </div>
        </div>
      )}
    </div>
  );
}
