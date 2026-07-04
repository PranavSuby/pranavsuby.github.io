import { useState, useEffect, useRef } from 'react';
import { AppScreen, ProgressRing } from '../ui';
import { Play, Square, Clock } from 'lucide-react';
import { getActiveFast, startFast, stopFast, getFastHistory } from './db';
import { alertTimerDone, ensureNotifyPermission } from '../utils/alerts';

const PROTOCOLS = [
  { label: '16:8',   targetHours: 16, desc: '16h fast · 8h eating window' },
  { label: '18:6',   targetHours: 18, desc: '18h fast · 6h eating window' },
  { label: '20:4',   targetHours: 20, desc: '20h fast · 4h eating window' },
  { label: 'Custom', targetHours: null, desc: 'Set your own duration' },
];

function formatHMS(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(startTs, endTs) {
  const ms = new Date(endTs) - new Date(startTs);
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function FastingScreen() {
  const [activeFast,   setActiveFast]   = useState(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [history,      setHistory]      = useState([]);
  const [protocolIdx,  setProtocolIdx]  = useState(0);
  const [customHours,  setCustomHours]  = useState(12);
  const [loading,      setLoading]      = useState(true);
  const intervalRef = useRef(null);
  const alertedRef  = useRef(false);

  useEffect(() => {
    loadState();
    return () => clearInterval(intervalRef.current);
  }, []); // intentional: run once on mount

  // Elapsed is recomputed from the absolute start timestamp on every tick (and when the
  // tab becomes visible again), so it stays correct even while backgrounded. Fires a
  // goal alert when the target is first crossed during this session.
  useEffect(() => {
    if (!activeFast) { clearInterval(intervalRef.current); return; }

    const target = activeFast.targetSecs || 0;
    const initial = Math.floor((Date.now() - new Date(activeFast.startTs)) / 1000);
    alertedRef.current = target > 0 && initial >= target; // already past goal on load → don't re-alert

    function tick() {
      const secs = Math.floor((Date.now() - new Date(activeFast.startTs)) / 1000);
      setElapsed(secs);
      if (target > 0 && secs >= target && !alertedRef.current) {
        alertedRef.current = true;
        alertTimerDone('Fast complete', `You reached your ${Math.round(target / 3600)}h goal 🎉`);
      }
    }

    tick();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(intervalRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [activeFast]);

  async function loadState() {
    setLoading(true);
    const [active, hist] = await Promise.all([getActiveFast(), getFastHistory(10)]);
    setActiveFast(active);
    setHistory(hist);
    setLoading(false);
  }

  async function handleStart() {
    const proto      = PROTOCOLS[protocolIdx];
    const hours      = proto.targetHours ?? customHours;
    const targetSecs = hours * 3600;
    ensureNotifyPermission(); // so we can alert when the goal is hit while backgrounded
    await startFast(proto.label, targetSecs);
    setElapsed(0);
    await loadState();
  }

  async function handleStop(completed) {
    if (!activeFast) return;
    await stopFast(activeFast.id, completed);
    setActiveFast(null);
    setElapsed(0);
    await loadState();
  }

  if (loading) return <div className="nc-loader">Loading…</div>;

  const targetSecs = activeFast?.targetSecs || 0;
  const progress   = targetSecs > 0 ? Math.min(1, elapsed / targetSecs) : 0;
  const isComplete = targetSecs > 0 && elapsed >= targetSecs;


  return (
    <AppScreen noPadding>
      <div className="nc-fast-container">
        {activeFast ? (
          <>
            {/* Arc ring */}
            <div className="nc-fast-ring-wrap">
              <ProgressRing
                value={elapsed} total={targetSecs > 0 ? targetSecs : 1}
                size={200} strokeWidth={16}
                color={isComplete ? 'var(--nc-a3)' : 'var(--nc-accent)'}
                trackColor="var(--nc-neutral)"
                transition="1s linear"
              />
              <div className="nc-fast-ring-center">
                <div className="nc-fast-elapsed">{formatHMS(elapsed)}</div>
                <div className="nc-fast-label">{isComplete ? 'Goal Reached!' : 'fasting'}</div>
                {targetSecs > 0 && (
                  <div className="nc-fast-target">of {Math.round(targetSecs / 3600)}h</div>
                )}
              </div>
            </div>

            <div className="nc-fast-protocol-badge">{activeFast.protocol}</div>

            <div className="nc-fast-actions">
              {/* completed reflects reality: true only once the goal was actually reached */}
              <button className="nc-fast-stop-btn" onClick={() => handleStop(isComplete)}>
                <Square size={15} /> {isComplete ? 'Complete Fast' : 'End Fast'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nc-fast-idle">
              <Clock size={44} className="nc-fast-idle-icon" />
              <div className="nc-fast-idle-title">Start a Fast</div>
              <div className="nc-fast-idle-sub">Choose your fasting protocol</div>
            </div>

            <div className="nc-fast-protocols">
              {PROTOCOLS.map((p, i) => (
                <button
                  key={p.label}
                  className={`nc-fast-proto-btn${protocolIdx === i ? ' active' : ''}`}
                  onClick={() => setProtocolIdx(i)}
                >
                  <div className="nc-fast-proto-label">{p.label}</div>
                  <div className="nc-fast-proto-desc">{p.desc}</div>
                </button>
              ))}
            </div>

            {PROTOCOLS[protocolIdx].targetHours === null && (
              <div className="nc-fast-custom-row">
                <span className="nc-fast-custom-label">Duration</span>
                <input
                  type="number" className="nc-weight-input" style={{ width: 80 }}
                  value={customHours} min={1} max={96} step={1}
                  onChange={e => setCustomHours(Math.max(1, Number(e.target.value)))}
                />
                <span className="nc-fast-custom-label">hours</span>
              </div>
            )}

            <button className="nc-fast-start-btn" onClick={handleStart}>
              <Play size={17} /> Start Fasting
            </button>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="nc-fast-history">
            <div className="nc-section-title">Recent Fasts</div>
            <div className="nc-card">
              {history.map((f, i) => (
                <div
                  key={f.id}
                  className="nc-field-row"
                  style={{ borderBottom: i < history.length - 1 ? undefined : 'none' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nc-text)' }}>{f.protocol}</div>
                    <div style={{ fontSize: 11, color: 'var(--nc-text3)', marginTop: 2 }}>
                      {new Date(f.startTs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: f.completed ? 'var(--nc-accent)' : 'var(--nc-text2)' }}>
                      {formatDuration(f.startTs, f.endTs)}
                    </div>
                    <div style={{ fontSize: 10, color: f.completed ? 'var(--nc-accent)' : 'var(--nc-text3)', marginTop: 2 }}>
                      {f.completed ? 'Completed' : 'Stopped early'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 8 }} />
    </AppScreen>
  );
}
