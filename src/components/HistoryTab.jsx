import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Dumbbell, Calendar as CalendarIcon, Ruler, Settings } from 'lucide-react';
import { deleteSession, saveRoutine } from '../db';
import { useApp } from '../contexts/AppContext';
import { fmtDate } from '../utils/format';
import ExercisesTab from './ExercisesTab';
import { AppScreen, KeepAlive } from '../ui';
import GymSettings from './GymSettings';
import MeasuresView from './MeasuresView';
import { ActivityChart } from './history/ActivityChart';
import { StatisticsView, SetCountView, MuscleRadarView, BodyDistributionView } from './history/StatisticsViews';
import { SessionCard } from './history/SessionCard';
import EditSessionView from './history/EditSessionView';
import { CalendarView } from './history/Calendar';
import { Toast, DashboardTile } from './history/widgets';

// ── HistoryTab ────────────────────────────────────────────────────────────────
export default function HistoryTab({ active }) {
  const { sessions: rawSessions, refreshSessions } = useApp();
  const sessions = useMemo(
    () => [...rawSessions].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [rawSessions]
  );
  const [view, setView] = useState('main');
  const [bodyOrigin, setBodyOrigin] = useState('main');
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editSession, setEditSession] = useState(null);

  useEffect(() => { if (active) refreshSessions(); }, [active, refreshSessions]);

  const handleDelete = useCallback(async (id) => {
    await deleteSession(id);
    refreshSessions();
  }, [refreshSessions]);

  const handleCopy = useCallback(async (session) => {
    // Keep the full exercise identity (tracking type, units, image…) so time-based
    // exercises and per-exercise units survive the round-trip, and store clean routine
    // sets rather than live-session set objects. Exercises with no completed sets fall
    // back to their full set list so they don't come back empty.
    const routine = {
      id: `routine-copy-${Date.now()}`,
      title: session.title || 'Copied Workout',
      createdAt: new Date().toISOString(),
      exercises: (session.exercises || []).map(ex => {
        const src = (ex.sets || []).filter(s => s.completed);
        const sets = (src.length ? src : (ex.sets || [])).map(s => ({
          reps: s.reps ?? '', weight: s.weight ?? '', time: s.time ?? '',
        }));
        return {
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart ?? '',
          equipment: ex.equipment ?? '',
          trackingType: ex.trackingType ?? 'reps',
          imageUrl: ex.imageUrl ?? null,
          units: ex.units ?? null,
          restTime: ex.restTime ?? null,
          sets: sets.length ? sets : [{ reps: '', weight: '', time: '' }],
        };
      }),
    };
    await saveRoutine(routine);
    setToast('Copied to My Routines');
  }, []);

  const openBody = (origin) => { setBodyOrigin(origin); setView('body'); };

  const groups = useMemo(() => {
    const result = [];
    const seen = new Map();
    for (const s of sessions) {
      const label = fmtDate(s.date);
      if (!seen.has(label)) { seen.set(label, []); result.push({ label, items: seen.get(label) }); }
      seen.get(label).push(s);
    }
    return result;
  }, [sessions]);

  return (
    <>
      {/* ── Main view ── */}
      <KeepAlive active={view === 'main'}>
        <AppScreen noPadding header={
          <div style={{ padding: '16px 16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>History</h1>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 6, display: 'flex' }}
            >
              <Settings size={22} />
            </button>
          </div>
        }>
          <div style={{ paddingTop: 16 }}>
            <ActivityChart sessions={sessions} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '0 16px', marginBottom: 24 }}>
            <DashboardTile icon={TrendingUp}   label="Statistics" onTap={() => setView('statistics')} />
            <DashboardTile icon={Dumbbell}     label="Exercises"  onTap={() => setView('exercises')} />
            <DashboardTile icon={Ruler}        label="Measures"   onTap={() => setView('measures')} />
            <DashboardTile icon={CalendarIcon} label="Calendar"   onTap={() => setView('calendar')} />
          </div>

          <div style={{ padding: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Workouts</h2>
            {sessions.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                No workouts yet. Complete a session to see it here.
              </div>
            ) : (
              groups.map(({ label, items }) => (
                <div key={label}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, marginTop: 16 }}>
                    {label}
                  </div>
                  {items.map(session => (
                    <SessionCard key={session.id} session={session} onDelete={handleDelete} onCopy={handleCopy} onEdit={setEditSession} />
                  ))}
                </div>
              ))
            )}
          </div>
        </AppScreen>
      </KeepAlive>

      {/* ── Sub-view overlays ── */}
      {view === 'statistics' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)' }}>
          <StatisticsView
            sessions={sessions}
            onBack={() => setView('main')}
            onOpenSetCount={() => setView('set-count')}
            onOpenMuscleChart={() => setView('muscle-chart')}
            onOpenMuscleBody={() => openBody('statistics')}
          />
        </div>
      )}
      {view === 'set-count' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'var(--bg)' }}>
          <SetCountView sessions={sessions} onBack={() => setView('statistics')} />
        </div>
      )}
      {view === 'muscle-chart' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'var(--bg)' }}>
          <MuscleRadarView sessions={sessions} onBack={() => setView('statistics')} />
        </div>
      )}
      {view === 'measures' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)' }}>
          <MeasuresView onBack={() => setView('main')} />
        </div>
      )}
      {view === 'exercises' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)' }}>
          <ExercisesTab onBack={() => setView('main')} />
        </div>
      )}
      {view === 'calendar' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)' }}>
          <CalendarView sessions={sessions} onBack={() => setView('main')} />
        </div>
      )}
      {view === 'body' && (
        <BodyDistributionView sessions={sessions} onClose={() => setView(bodyOrigin)} />
      )}

      {editSession && (
        <EditSessionView
          session={editSession}
          onClose={() => setEditSession(null)}
          onSaved={() => {
            setEditSession(null);
            refreshSessions();
            setToast('Workout updated');
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <GymSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
