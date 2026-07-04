import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSessionsForExercise } from '../db';
import { cap } from '../utils/exercises';
import { useBackClose } from '../ui';
import { BG, BORDER, ACCENT, ACCENT_DIM, TEXT1, TEXT2, TEXT3, PILL_BG } from './exerciseDetail/theme';
import { SummaryTab } from './exerciseDetail/SummaryTab';
import { HistoryTab } from './exerciseDetail/HistoryView';
import { ChartsTab } from './exerciseDetail/ChartsTab';

// ─── ExerciseDetail ───────────────────────────────────────────────────────────
export default function ExerciseDetail({ exercise, onBack }) {
  useBackClose(onBack);
  const [tab, setTab]       = useState('summary');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    getSessionsForExercise(exercise.name)
      .then(s => setSessions(s || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [exercise.name]);

  const TABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'history', label: 'History' },
    { id: 'charts',  label: 'Charts'  },
  ];

  return (
    <div
      className="ex-detail"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: BG,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.5; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: BG,
          borderBottom: `1px solid ${BORDER}`,
          padding: '12px 16px',
          flexShrink: 0,
        }}
      >
        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: TEXT2,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: TEXT1,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {exercise.name}
          </h1>
        </div>

        {/* badges */}
        <div style={{ display: 'flex', gap: 6, paddingLeft: 36, flexWrap: 'wrap' }}>
          {exercise.equipment && (
            <span
              style={{
                fontSize: 11,
                color: TEXT3,
                background: PILL_BG,
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {cap(exercise.equipment)}
            </span>
          )}
          {exercise.bodyPart && (
            <span
              style={{
                fontSize: 11,
                color: ACCENT,
                background: ACCENT_DIM,
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {cap(exercise.bodyPart)}
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            marginTop: 14,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                  color: active ? ACCENT : TEXT3,
                  fontSize: 14,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '16px 16px 32px', minWidth: 0 }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              color: TEXT3,
              fontSize: 14,
            }}
          >
            Loading…
          </div>
        ) : (
          <>
            {tab === 'summary' && (
              <SummaryTab exercise={exercise} sessions={sessions} />
            )}
            {tab === 'history' && (
              <HistoryTab exercise={exercise} sessions={sessions} />
            )}
            {tab === 'charts' && (
              <ChartsTab exercise={exercise} sessions={sessions} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
