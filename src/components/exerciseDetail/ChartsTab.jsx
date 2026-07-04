import { useState } from 'react';
import { TrendingUp, Award } from 'lucide-react';
import { buildChartData, exerciseUnit } from '../../utils/stats';
import { fmtShortDate } from '../../utils/format';
import { LineChart } from './LineChart';
import { SURFACE, BORDER, ACCENT, ACCENT_DIM, TEXT1, TEXT2, TEXT3, PR_COLOR } from './theme';

const RANGES = [
  { label: '1M',  months: 1  },
  { label: '3M',  months: 3  },
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
  { label: 'All', months: null },
];

function filterByRange(points, months) {
  if (!months) return points;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return points.filter(p => new Date(p.date) >= cutoff);
}

// ─── ChartsTab ────────────────────────────────────────────────────────────────
export function ChartsTab({ exercise, sessions }) {
  const isTimeBased = exercise.trackingType === 'time';
  const unit = exerciseUnit(sessions, exercise.name);

  const METRICS = isTimeBased
    ? [
        { key: 'duration', label: 'Best Duration', unit: 's' },
        { key: 'volume',   label: 'Total Duration', unit: 's' },
        { key: 'reps',     label: 'Sets Done',       unit: '' },
      ]
    : [
        { key: 'weight', label: 'Best Weight', unit },
        { key: '1rm',    label: 'Est. 1RM',    unit },
        { key: 'volume', label: 'Volume',      unit },
        { key: 'reps',   label: 'Max Reps',    unit: '' },
      ];

  const [metric,    setMetric]    = useState(METRICS[0].key);
  const [rangeIdx,  setRangeIdx]  = useState(RANGES.length - 1); // default: All

  const allPoints  = buildChartData(sessions, exercise.name, metric);
  const filtered   = filterByRange(allPoints, RANGES[rangeIdx].months);

  const currentMetaDef = METRICS.find(m => m.key === metric) || METRICS[0];

  // Current value = last filtered point
  const currentPoint   = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  const allTimeMax     = allPoints.length > 0 ? Math.max(...allPoints.map(p => p.value)) : 0;
  const isCurrentPR    = currentPoint && allPoints.length > 1 && currentPoint.value >= allTimeMax;

  const fmtValue = v => {
    if (v === null || v === undefined) return '—';
    if (currentMetaDef.key === 'volume' && v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metric pills */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: 2,
        }}
      >
        {METRICS.map(m => {
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={(e) => { setMetric(m.key); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                border: active ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                background: active ? ACCENT_DIM : 'transparent',
                color: active ? ACCENT : TEXT2,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Time range segmented control */}
      <div
        style={{
          display: 'flex',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 3,
          gap: 2,
        }}
      >
        {RANGES.map((r, i) => {
          const active = rangeIdx === i;
          return (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                border: 'none',
                background: active ? ACCENT : 'transparent',
                color: active ? '#fff' : TEXT3,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Current value headline */}
      {currentPoint && (
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <TrendingUp size={18} color={ACCENT} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Latest — {fmtShortDate(currentPoint.date)}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: TEXT1 }}>
                {fmtValue(currentPoint.value)}
              </span>
              {currentMetaDef.unit && (
                <span style={{ fontSize: 14, color: TEXT3 }}>{currentMetaDef.unit}</span>
              )}
              {isCurrentPR && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(251,191,36,0.15)',
                    border: '1px solid rgba(251,191,36,0.4)',
                    color: PR_COLOR,
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}
                >
                  PR
                </span>
              )}
            </div>
          </div>
          <Award size={18} color={isCurrentPR ? PR_COLOR : TEXT3} />
        </div>
      )}

      {/* Chart */}
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '14px 10px 8px',
        }}
      >
        <LineChart points={filtered} />
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 12, color: TEXT3, textAlign: 'center' }}>
          {filtered.length} session{filtered.length !== 1 ? 's' : ''} in this period
        </div>
      )}
    </div>
  );
}
