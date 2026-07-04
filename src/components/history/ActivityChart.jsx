import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { PeriodSelector } from '../../ui';
import { chartTooltip } from '../../ui/chart';
import { aggregateBarData, getPeriodSummary, PERIOD_OPTS, METRIC_OPTS } from './helpers';

// ── ActivityChart ─────────────────────────────────────────────────────────────
export function ActivityChart({ sessions }) {
  const { settings } = useApp();
  const units = settings?.units ?? 'kg';
  const [period, setPeriod] = useState('3m');
  const [metric, setMetric] = useState('duration');

  const barData = useMemo(() => aggregateBarData(sessions, period), [sessions, period]);
  const summary = useMemo(() => getPeriodSummary(sessions, period), [sessions, period]);

  // Volume bars are stored in kg — convert to the user's unit for display.
  const toUnit = (kg) => (units === 'lbs' ? kg * 2.20462 : kg);
  const fmtBarVal = (v) => {
    if (metric === 'duration') return v >= 3600 ? `${(v / 3600).toFixed(1)}h` : `${Math.round(v / 60)}m`;
    if (metric === 'volume') { const u = toUnit(v); return u >= 1000 ? `${(u / 1000).toFixed(1)}k` : `${Math.round(u)}`; }
    return String(v);
  };

  const summaryText = () => {
    const mins = summary.totalMin;
    const hrs = mins >= 3600 ? `${(mins / 3600).toFixed(1)} hrs` : `${Math.round(mins / 60)} min`;
    return `${summary.count} workouts · ${hrs} total`;
  };

  return (
    <div style={{ margin: '0 16px 16px', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)', padding: '14px 16px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{summaryText()}</span>
        <PeriodSelector options={PERIOD_OPTS} value={period} onChange={setPeriod} />
      </div>

      <div style={{ display: 'flex', marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {METRIC_OPTS.map(o => (
          <button key={o.id} onClick={() => setMetric(o.id)} style={{
            flex: 1, padding: '7px 0', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: metric === o.id ? 'var(--accent)' : 'var(--text3)',
            borderBottom: metric === o.id ? '2px solid var(--accent)' : '2px solid transparent',
          }}>{o.label}</button>
        ))}
      </div>

      {barData.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={barData} barSize={barData.length > 20 ? 4 : 8} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={fmtBarVal} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [metric === 'volume' ? `${fmtBarVal(v)} ${units}` : fmtBarVal(v), metric]}
              contentStyle={chartTooltip.contentStyle} labelStyle={chartTooltip.labelStyle}
            />
            <Bar dataKey={metric} fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
