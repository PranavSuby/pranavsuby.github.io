import { X, Minus, Plus } from 'lucide-react';
import { ProgressRing } from '../../ui';
import { styles } from './styles';

// ── PR Banner ─────────────────────────────────────────────────────────────────
export function PrBanner({ prBanner }) {
  if (!prBanner) return null;
  const unit = prBanner.unit || 'kg';
  const suffix = prBanner.type === '1rm' ? ` ${unit} e1RM` : ` ${unit}`;
  return (
    <div style={styles.prBanner}>
      🏆 New PR — {prBanner.exerciseName}: {prBanner.value}{suffix}
    </div>
  );
}

// ── Rest Timer Overlay ────────────────────────────────────────────────────────
export function RestTimerOverlay({ restTimer, onSkip, onAdjust }) {
  if (!restTimer) return null;
  const { remaining, total } = restTimer;

  return (
    <div style={styles.restTimerWrap}>
      <div style={styles.restTimerCard}>
        <button style={styles.restAdjBtn} onClick={() => onAdjust(-15)}>
          <Minus size={14} /><span style={{ fontSize: 11, marginLeft: 2 }}>15s</span>
        </button>
        <div style={styles.restCircleWrap}>
          <ProgressRing value={remaining} total={total} size={64} strokeWidth={4} color="var(--accent-bright)" trackColor="var(--bg3)" transition="0.9s linear" />
          <span style={styles.restSecs}>{remaining}s</span>
        </div>
        <button style={styles.restAdjBtn} onClick={() => onAdjust(15)}>
          <Plus size={14} /><span style={{ fontSize: 11, marginLeft: 2 }}>15s</span>
        </button>
        <button style={styles.restSkipBtn} onClick={onSkip}><X size={16} /></button>
      </div>
    </div>
  );
}
