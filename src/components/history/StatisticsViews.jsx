import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { calcVolume, calcSets } from '../../utils/stats';
import { getExerciseByName } from '../../utils/exercises';
import MuscleDiagram, { BP_MAP } from '../MuscleDiagram';
import { PeriodSelector, useBackClose } from '../../ui';
import { chartTooltip } from '../../ui/chart';
import {
  fmtVol, getPeriodCutoff, getBodyPartSets, aggregateSetCountData, getRadarData,
  weekStartFor, formatWeekRange,
  PERIOD_OPTS, LINE_COLORS, DAY_ABBR, MUSCLE_LIST,
} from './helpers';

// ── BodyGraph (used in StatisticsView) ────────────────────────────────────────
function BodyGraph({ sessions, onTap }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return d;
    });
  }, []);

  const sessionDateKeys = useMemo(() => {
    const set = new Set();
    for (const s of sessions) set.add(new Date(s.date).toLocaleDateString('en-CA'));
    return set;
  }, [sessions]);

  const muscleIntensities = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 6);

    const counts = {};
    for (const s of sessions) {
      if (new Date(s.date) < cutoff) continue;
      for (const ex of s.exercises || []) {
        const bp = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
        const slugs = BP_MAP[bp];
        if (slugs) {
          const n = (ex.sets || []).filter(set => set.completed).length;
          slugs.forEach(slug => { counts[slug] = (counts[slug] || 0) + n; });
        }
      }
    }
    const result = {};
    for (const [k, v] of Object.entries(counts)) result[k] = v <= 0 ? 0 : Math.min(0.2 + (v - 1) / 19 * 0.8, 1);
    return result;
  }, [sessions]);

  return (
    <div onClick={onTap} style={{ margin: '0 16px 16px', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Last 7 days</span>
      </div>

      <div style={{ display: 'flex', gap: 5, padding: '0 12px 14px' }}>
        {days.map((d, i) => {
          const key = d.toLocaleDateString('en-CA');
          const hasWorkout = sessionDateKeys.has(key);
          const isToday = i === 6;
          return (
            <div key={i} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '7px 2px 5px',
              background: isToday ? 'var(--bg3)' : 'var(--bg)',
              borderRadius: 8,
              border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
              gap: 2,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text3)', letterSpacing: '0.03em' }}>
                {DAY_ABBR[d.getDay()]}
              </span>
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--text)' : 'var(--text2)' }}>
                {d.getDate()}
              </span>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasWorkout ? 'var(--accent)' : 'transparent' }} />
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 12px 16px' }}>
        <MuscleDiagram intensities={muscleIntensities} />
      </div>
    </div>
  );
}

// ── BodyDistributionView ──────────────────────────────────────────────────────
export function BodyDistributionView({ sessions, onClose }) {
  useBackClose(onClose);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => weekStartFor(weekOffset), [weekOffset]);
  const weekEnd   = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d; }, [weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  }), [weekStart]);

  const weekSessions = useMemo(() => {
    const sk = weekStart.toLocaleDateString('en-CA');
    const ek = weekEnd.toLocaleDateString('en-CA');
    return sessions.filter(s => {
      const k = new Date(s.date).toLocaleDateString('en-CA');
      return k >= sk && k <= ek;
    });
  }, [sessions, weekStart, weekEnd]);

  const sessionDateKeys = useMemo(() => {
    const set = new Set();
    for (const s of weekSessions) set.add(new Date(s.date).toLocaleDateString('en-CA'));
    return set;
  }, [weekSessions]);

  const bodyPartCounts = useMemo(() => {
    const counts = {};
    for (const s of weekSessions) {
      for (const ex of s.exercises || []) {
        const bp = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
        if (BP_MAP[bp]) {
          const n = (ex.sets || []).filter(set => set.completed).length;
          counts[bp] = (counts[bp] || 0) + n;
        }
      }
    }
    return counts;
  }, [weekSessions]);

  const intensities = useMemo(() => {
    const counts = {};
    for (const s of weekSessions) {
      for (const ex of s.exercises || []) {
        const bp = (ex.bodyPart || getExerciseByName(ex.name)?.bodyPart || '').toLowerCase();
        const slugs = BP_MAP[bp];
        if (slugs) {
          const n = (ex.sets || []).filter(set => set.completed).length;
          slugs.forEach(slug => { counts[slug] = (counts[slug] || 0) + n; });
        }
      }
    }
    const result = {};
    for (const [k, v] of Object.entries(counts)) result[k] = v <= 0 ? 0 : Math.min(0.2 + (v - 1) / 19 * 0.8, 1);
    return result;
  }, [weekSessions]);

  const totalSets = useMemo(() => Object.values(bodyPartCounts).reduce((a, b) => a + b, 0), [bodyPartCounts]);
  const todayKey  = new Date().toLocaleDateString('en-CA');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 170, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(var(--safe-top) + 16px) 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Body distribution</span>
        <div style={{ width: 30 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 10px' }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{formatWeekRange(weekStart, weekEnd)}</span>
          <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0} style={{ background: 'none', border: 'none', color: weekOffset >= 0 ? 'var(--border)' : 'var(--text)', cursor: weekOffset >= 0 ? 'default' : 'pointer', padding: 6, display: 'flex' }}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '0 16px 20px' }}>
          {days.map((d, i) => {
            const key = d.toLocaleDateString('en-CA');
            const hasWorkout = sessionDateKeys.has(key);
            const isToday = key === todayKey;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{DAY_ABBR[d.getDay()]}</span>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hasWorkout ? 'var(--accent)' : 'transparent',
                  border: isToday && !hasWorkout ? '1.5px solid var(--text3)' : 'none',
                }}>
                  <span style={{ fontSize: 13, fontWeight: hasWorkout ? 700 : 400, color: hasWorkout ? '#fff' : isToday ? 'var(--text)' : 'var(--text2)' }}>
                    {d.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '0 16px 28px' }}>
          <MuscleDiagram intensities={intensities} size={165} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Muscle</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Sets</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{totalSets}</span>
          </div>
          {MUSCLE_LIST.map(({ label, key }) => {
            const count = bodyPartCounts[key] || 0;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 15, color: count > 0 ? 'var(--text)' : 'var(--text3)' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── StatisticsView ────────────────────────────────────────────────────────────
export function StatisticsView({ sessions, onBack, onOpenSetCount, onOpenMuscleChart, onOpenMuscleBody }) {
  useBackClose(onBack);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 16px) 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Statistics</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 32px' }}>
        <div style={{ paddingTop: 16 }}>
          <BodyGraph sessions={sessions} onTap={onOpenMuscleBody} />
        </div>

        <div style={{ padding: '20px 16px 8px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Advanced statistics
          </span>
        </div>
        {[
          { label: 'Set count per muscle group', onTap: onOpenSetCount },
          { label: 'Muscle distribution chart',  onTap: onOpenMuscleChart },
          { label: 'Muscle distribution (body)', onTap: onOpenMuscleBody },
        ].map(({ label, onTap }) => (
          <button key={label} onClick={onTap} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '16px 20px', background: 'none', border: 'none',
            borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 15,
            textAlign: 'left',
          }}>
            {label}
            <ChevronRight size={16} color="var(--text3)" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SetCountView ──────────────────────────────────────────────────────────────
export function SetCountView({ sessions, onBack }) {
  useBackClose(onBack);
  const [period, setPeriod] = useState('3m');
  const { lines, data } = useMemo(() => aggregateSetCountData(sessions, period), [sessions, period]);

  const totals = useMemo(() => {
    const cutoff = getPeriodCutoff(period);
    const bp = getBodyPartSets(sessions, cutoff);
    return Object.entries(bp).sort((a, b) => b[1] - a[1]);
  }, [sessions, period]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 16px) 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Set count per muscle</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 32px' }}>
        <div style={{ padding: '0 16px 16px' }}>
          <PeriodSelector options={PERIOD_OPTS} value={period} onChange={setPeriod} />
        </div>

        {data.length === 0 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No data for this period
          </div>
        ) : (
          <div style={{ padding: '0 0 20px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltip.contentStyle} labelStyle={chartTooltip.labelStyle} />
                {lines.map((muscle, i) => (
                  <Line key={muscle} type="monotone" dataKey={muscle} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        dot={false} strokeWidth={1.5} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {totals.map(([muscle, count]) => (
            <div key={muscle} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, color: 'var(--text)', textTransform: 'capitalize' }}>{muscle}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MuscleRadarView ───────────────────────────────────────────────────────────
export function MuscleRadarView({ sessions, onBack }) {
  useBackClose(onBack);
  const { settings } = useApp();
  const units = settings?.units ?? 'kg';
  const [period, setPeriod] = useState('3m');
  const radarData = useMemo(() => getRadarData(sessions, period), [sessions, period]);

  const filtered = useMemo(() => {
    const c = getPeriodCutoff(period);
    return c ? sessions.filter(s => new Date(s.date) >= c) : sessions;
  }, [sessions, period]);
  const totalSets = useMemo(() => filtered.reduce((a, s) => a + calcSets(s.exercises || []), 0), [filtered]);
  const totalVol  = useMemo(() => filtered.reduce((a, s) => a + calcVolume(s.exercises || []), 0), [filtered]);
  const totalMin  = useMemo(() => filtered.reduce((a, s) => a + (s.duration || 0), 0), [filtered]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 16px) 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Muscle distribution</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 32px' }}>
        <div style={{ padding: '0 16px 16px' }}>
          <PeriodSelector options={PERIOD_OPTS} value={period} onChange={setPeriod} />
        </div>

        <div style={{ padding: '0 0 8px' }}>
          <div style={{ display: 'flex', gap: 16, padding: '0 20px 12px', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 2, background: '#3b82f6', borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Current</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 2, background: '#94a3b8', borderRadius: 1, borderTop: '2px dashed #94a3b8', height: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Previous</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="group" tick={{ fontSize: 12, fill: 'var(--text2)' }} />
              <Radar name="Current"  dataKey="current"  stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
              <Radar name="Previous" dataKey="previous" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              <Tooltip contentStyle={chartTooltip.contentStyle} labelStyle={chartTooltip.labelStyle} formatter={(v) => [`${Math.round(v)}%`]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '0 16px 16px' }}>
          {[
            { label: 'Workouts', value: filtered.length },
            { label: 'Duration', value: totalMin >= 3600 ? `${(totalMin / 3600).toFixed(1)}h` : `${Math.round(totalMin / 60)}m` },
            { label: 'Volume',   value: fmtVol(totalVol, units) },
            { label: 'Sets',     value: totalSets },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
