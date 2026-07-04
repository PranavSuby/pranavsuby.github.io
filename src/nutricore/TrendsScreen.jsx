import { useState, useEffect } from 'react';
import { AppScreen, PeriodSelector } from '../ui';
import { chartTooltip } from '../ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer,
  LineChart, Line, Tooltip,
} from 'recharts';
import { Plus } from 'lucide-react';
import { getCalorieHistory, getBiometricsInRange, addBiometric, getGoalsForDate, getProfile } from './db';
import { useNutriCore } from './NCContext';
import { kgToDisplay, displayToKg, weightUnit } from './units';
import { toDateStr } from '../utils/dates';

const RANGES = [
  { id: '7d',  label: '7d',  days: 7  },
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return toDateStr(d);
}

// Days elapsed between two YYYY-MM-DD date strings.
function daysBetween(a, b) {
  return (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000;
}

// x is real days elapsed since the first point (not array index), so slope is a
// true per-day rate even when weigh-ins aren't daily.
function linearRegression(weightData) {
  const n = weightData.length;
  if (n < 2) return null;
  const x0 = weightData[0].date;
  const xs = weightData.map(d => daysBetween(x0, d.date));
  const ys = weightData.map(d => d.weightKg);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: yMean - slope * xMean };
}

function xLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

// Project when the goal weight is reached from the actual rate of change over the
// logged window. weightData values are already in display units.
function computeEta(weightData, goalDisplay) {
  if (!goalDisplay || weightData.length < 2) return null;
  const first = weightData[0];
  const last  = weightData[weightData.length - 1];
  const latest = last.weightKg;
  const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  const ratePerDay = (latest - first.weightKg) / days;
  const remaining = goalDisplay - latest;
  if (Math.abs(remaining) < 0.1) return { state: 'reached' };
  if (ratePerDay === 0 || Math.sign(ratePerDay) !== Math.sign(remaining)) return { state: 'away' };
  const daysToGo = remaining / ratePerDay;
  if (daysToGo > 5 * 365) return { state: 'slow' };
  const eta = new Date();
  eta.setDate(eta.getDate() + Math.round(daysToGo));
  return { state: 'ontrack', daysToGo: Math.round(daysToGo), eta };
}

export default function TrendsScreen() {
  const { updateProfile, dataVersion, bumpData } = useNutriCore();
  const [range, setRange]              = useState('30d');
  const [calorieData, setCalorieData] = useState([]);
  const [weightData, setWeightData]   = useState([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [weightInput, setWeightInput] = useState('');
  const [unitW, setUnitW]             = useState('kg');
  const [unitE, setUnitE]             = useState('kcal');
  const [loading, setLoading]         = useState(true);
  const [profile, setProfile]         = useState(null);
  const [goalInput, setGoalInput]     = useState('');

  const days = RANGES.find(r => r.id === range)?.days ?? 30;

  // Reload on range change and whenever diary/biometric data changes elsewhere.
  useEffect(() => { load(); }, [range, dataVersion]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const start = daysAgo(days);
    const end   = toDateStr(new Date());
    const [kcalHist, wHist, goals, prof] = await Promise.all([
      getCalorieHistory(start, end),
      getBiometricsInRange('weight_kg', start, end),
      getGoalsForDate(end),
      getProfile(),
    ]);
    const uw = prof?.unitWeight || 'kg';
    const ue = prof?.unitEnergy || 'kcal';
    setUnitW(uw);
    setUnitE(ue);
    setProfile(prof);
    setGoalInput(prof?.goalWeightKg != null ? String(kgToDisplay(prof.goalWeightKg, uw)) : '');
    setCalorieData(kcalHist);
    // Dedupe multiple weigh-ins on the same day — keep the latest (later same-day
    // records come last in insertion order, so they win).
    const byDay = new Map();
    for (const b of wHist) byDay.set(b.date, b);
    setWeightData([...byDay.values()].map(b => ({ date: b.date, weightKg: kgToDisplay(b.value, uw) })));
    setCalorieGoal(ue === 'kj' ? Math.round((goals?.kcal || 2000) * 4.184) : (goals?.kcal || 2000));
    setLoading(false);
  }

  async function handleSaveGoalWeight() {
    const v = parseFloat(goalInput);
    const goalWeightKg = isNaN(v) || v <= 0 ? null : displayToKg(v, unitW);
    const next = { ...(profile || {}), goalWeightKg };
    setProfile(next);
    await updateProfile(next);
  }

  async function handleLogWeight() {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    await addBiometric(toDateStr(new Date()), 'weight_kg', displayToKg(val, unitW));
    setWeightInput('');
    bumpData();   // weight feeds other screens; also reloads this one via dataVersion
  }

  const reg = weightData.length >= 2 ? linearRegression(weightData) : null;
  const weightWithTrend = weightData.map(d => ({
    ...d,
    trend: reg ? parseFloat((reg.intercept + reg.slope * daysBetween(weightData[0].date, d.date)).toFixed(2)) : undefined,
  }));

  const nonZero  = calorieData.filter(d => d.kcal > 0);
  const avgKcal  = nonZero.length ? Math.round(nonZero.reduce((s, d) => s + d.kcal, 0) / nonZero.length) : 0;
  const daysLogged = nonZero.length;

  const step  = days <= 7 ? 1 : days <= 30 ? 5 : 15;
  const wUnit = weightUnit(unitW);
  const eUnit = unitE === 'kj' ? 'kJ' : 'kcal';

  if (loading) return <div className="nc-loader">Loading…</div>;

  return (
    <AppScreen noPadding>
      {/* Range selector */}
      <div className="nc-trends-range">
        <PeriodSelector options={RANGES} value={range} onChange={setRange} />
      </div>

      {/* Calorie bar chart */}
      <div className="nc-trends-card">
        <div className="nc-trends-card-header">
          <span className="nc-trends-card-title">{eUnit}</span>
          <span className="nc-trends-avg">{avgKcal > 0 ? `avg ${avgKcal} ${eUnit}` : '—'}</span>
        </div>
        {nonZero.length === 0 ? (
          <div className="nc-trends-empty">Log foods to see calorie history</div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={calorieData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(v, i) => i % step === 0 ? xLabel(v) : ''}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <ReferenceLine y={calorieGoal} stroke="#F87171" strokeDasharray="4 4" strokeWidth={1} />
              <Bar dataKey="kcal" fill="#4ADE80" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="nc-trends-meta">
          <span>{daysLogged} day{daysLogged !== 1 ? 's' : ''} logged</span>
          <span style={{ color: '#F87171' }}>— goal line</span>
        </div>
      </div>

      {/* Weight section */}
      <div className="nc-trends-card">
        <div className="nc-trends-card-header">
          <span className="nc-trends-card-title">Weight ({wUnit})</span>
          {weightData.length > 0 && (
            <span className="nc-trends-avg">{weightData[weightData.length - 1].weightKg} {wUnit}</span>
          )}
        </div>

        <div className="nc-weight-input-row">
          <input
            className="nc-weight-input"
            type="number"
            step="0.1"
            placeholder={`Enter weight (${wUnit})`}
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogWeight()}
          />
          <button className="nc-weight-add-btn" onClick={handleLogWeight}>
            <Plus size={15} /> Log
          </button>
        </div>

        {weightWithTrend.length < 2 ? (
          <div className="nc-trends-empty">Log weight on 2+ days to see chart</div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weightWithTrend} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={v => xLabel(v)}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(weightWithTrend.length / 4) - 1)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={chartTooltip.contentStyle}
                labelStyle={{ color: '#9CA3AF' }}
                itemStyle={{ color: '#F9FAFB' }}
                formatter={v => [`${v} ${wUnit}`]}
              />
              <Line
                type="monotone" dataKey="weightKg" stroke="#4ADE80" strokeWidth={2}
                dot={{ r: 3, fill: '#4ADE80' }} activeDot={{ r: 5 }}
              />
              {reg && (
                <Line
                  type="monotone" dataKey="trend" stroke="#6366F1" strokeWidth={1.5}
                  dot={false} strokeDasharray="4 3"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        {reg && (
          <div className="nc-trends-meta">
            <span style={{ color: '#6366F1' }}>— trend</span>
            <span>{reg.slope >= 0 ? '+' : ''}{(reg.slope * 7).toFixed(2)} {wUnit}/wk</span>
          </div>
        )}

        {/* Goal weight + projection */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nc-border)' }}>
          <div className="nc-weight-input-row">
            <input
              className="nc-weight-input"
              type="number" step="0.1"
              placeholder={`Goal weight (${wUnit})`}
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveGoalWeight()}
            />
            <button className="nc-weight-add-btn" onClick={handleSaveGoalWeight}>Set goal</button>
          </div>
          {(() => {
            const eta = computeEta(weightData, parseFloat(goalInput));
            if (!eta) return null;
            const msg =
              eta.state === 'reached' ? '🎉 You’ve reached your goal weight!'
              : eta.state === 'away'  ? 'Your current trend is moving away from this goal.'
              : eta.state === 'slow'  ? 'At the current pace this goal is years away — consider adjusting.'
              : `On track to reach ${goalInput} ${wUnit} around ${eta.eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (~${eta.daysToGo} days).`;
            const color = eta.state === 'reached' || eta.state === 'ontrack' ? 'var(--nc-accent)' : 'var(--nc-text2)';
            return <div style={{ fontSize: 12.5, color, marginTop: 10, lineHeight: 1.45 }}>{msg}</div>;
          })()}
        </div>
      </div>

      <div style={{ height: 8 }} />
    </AppScreen>
  );
}
