import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, User, ChevronUp } from 'lucide-react';
import { AppProvider, useApp } from './contexts/AppContext';
import { WorkoutProvider, useWorkout } from './contexts/WorkoutContext';
import WorkoutTab from './components/WorkoutTab';
import HistoryTab from './components/HistoryTab';
import LiveWorkout from './components/LiveWorkout';
import { NavBar, TopBar, KeepAlive } from './ui';
import { fmtTime } from './utils/format';
import useWakeLock from './utils/useWakeLock';
import './index.css';

export default function GymApp() {
  return (
    <AppProvider>
      <WorkoutProvider>
        <GymAppInner />
      </WorkoutProvider>
    </AppProvider>
  );
}

function GymAppInner() {
  const navigate = useNavigate();
  const { session, elapsed, restTimer, isMinimized, expand } = useWorkout();
  const { settings } = useApp();
  const [tab, setTab] = useState('workout');

  // Keep the screen awake during an active workout when enabled.
  useWakeLock(!!session && !!settings.keepAwake);

  const TABS = [
    { id: 'workout', label: 'Workout', Icon: Dumbbell },
    { id: 'history', label: 'History', Icon: User },
  ];

  return (
    <div className="app-shell app">
      {/* Top bar — hidden during active session */}
      {!session && (
        <TopBar onBack={() => navigate('/')} backLabel="Apps" />
      )}

      {/* Tab content — KeepAlive preserves each tab's state across switches */}
      <KeepAlive active={tab === 'workout'}><WorkoutTab active={tab === 'workout'} /></KeepAlive>
      <KeepAlive active={tab === 'history'}><HistoryTab active={tab === 'history'} /></KeepAlive>

      {/* Minimized workout bar — shown when workout is active but collapsed. In-flow,
          directly above the nav so it never overlaps tab content. */}
      {session && isMinimized && (
        <div className="minimized-bar" onClick={expand}>
          <ChevronUp size={18} color="var(--accent)" />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title || 'Quick Workout'}
          </span>
          {restTimer && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pr-green)', fontVariantNumeric: 'tabular-nums', background: 'rgba(34,197,94,0.12)', borderRadius: 8, padding: '3px 8px' }}>
              Rest {fmtTime(restTimer.remaining)}
            </span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTime(elapsed)}
          </span>
        </div>
      )}

      {/* Bottom nav — always visible */}
      <NavBar tabs={TABS} activeId={tab} onSelect={setTab} iconSize={22} />

      {/* Live workout overlay */}
      {session && !isMinimized && <LiveWorkout onFinished={() => setTab('history')} />}
    </div>
  );
}
