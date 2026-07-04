import { useState, useEffect, useMemo } from 'react';
import { AppScreen } from '../ui';
import { Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { getDiaryForRange, getGoalsForDate, getLoggingStreak, getWaterForRange } from './db';
import { computeTotals } from './nutrition';
import { computeTDEE } from './tdee';
import { getDRI, computeScores } from './dri';
import { todayStr } from '../utils/dates';
import { getGymCaloriesForRange } from '../utils/gymCalories';
import { getPeriodRange, shiftPeriod, isCurrentPeriod, periodLabel, countDays, elapsedDays, scaleTotals } from './reportRange';
import { useNutriCore } from './NCContext';

function fmt(n, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '0'; }

// ── Gauge dial ────────────────────────────────────────────────────────────────
function Gauge({ label, value, max }) {
  const pct = Math.min(0.999, max > 0 ? value / max : 0);
  const CX = 60, CY = 60, R = 48;
  const alphaRad = Math.PI * (1 - pct);
  const endX = CX + R * Math.cos(alphaRad);
  const endY = CY - R * Math.sin(alphaRad);
  const needleR = 36;
  const nX = CX + needleR * Math.cos(alphaRad);
  const nY = CY - needleR * Math.sin(alphaRad);

  return (
    <div className="nc-gauge">
      <svg viewBox="0 0 120 90" width="130" height="97">
        {/* bg arc */}
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 1 0 ${CX + R} ${CY}`}
          fill="none" stroke="var(--nc-neutral)" strokeWidth="9" strokeLinecap="round" />
        {/* filled arc */}
        {pct > 0.002 && (
          <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
            fill="none" stroke="var(--nc-accent)" strokeWidth="9" strokeLinecap="round" />
        )}
        {/* needle */}
        <line x1={CX} y1={CY} x2={nX.toFixed(2)} y2={nY.toFixed(2)}
          stroke="var(--nc-text)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="4" fill="var(--nc-text)" />
        {/* value */}
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize="12" fontWeight="700"
          fill="var(--nc-text)">{value.toFixed(3)}</text>
        {/* 0 / max labels */}
        <text x={CX - R} y={CY + 22} textAnchor="middle" fontSize="9" fill="var(--nc-text3)">0</text>
        <text x={CX + R} y={CY + 22} textAnchor="middle" fontSize="9" fill="var(--nc-text3)">{max}</text>
      </svg>
      <div className="nc-gauge-label">{label}</div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="nc-section-collapsible">
      <div className="nc-section-coll-hdr" onClick={() => setOpen(o => !o)}>
        <span className="nc-section-coll-title">{title}</span>
        {open ? <ChevronUp size={16} color="var(--nc-text3)" /> : <ChevronDown size={16} color="var(--nc-text3)" />}
      </div>
      {open && children}
    </div>
  );
}

// ── Progress bar row ──────────────────────────────────────────────────────────
function NutrientRow({ label, amount, unit, goal, indent = 0, color = 'var(--nc-accent)' }) {
  const hasData = Number.isFinite(amount) && amount > 0;
  const pct = hasData && goal > 0 ? Math.min(100, Math.round((amount / goal) * 100)) : 0;
  return (
    <div className="nc-nutrient-item">
      <div className={`nc-nutrient-name${indent ? ' indent' : ''}`} style={{ paddingLeft: indent * 12 }}>
        {label}
      </div>
      <div className="nc-nutrient-amount">
        {hasData ? `${typeof amount === 'number' ? amount.toFixed(1) : amount} ${unit}` : '— No Data'}
      </div>
      <div className="nc-nutrient-bar-wrap">
        <div className="nc-nutrient-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="nc-nutrient-pct">{pct > 0 ? `${pct}%` : '0%'}</div>
    </div>
  );
}

// ── 2-col score grid ──────────────────────────────────────────────────────────
function ScoreGrid({ items }) {
  return (
    <div className="nc-two-col" style={{ padding: '4px 8px 8px' }}>
      {items.map(({ label, pct }) => (
        <div key={label} className="nc-grid-item">
          <div className="nc-grid-item-top">
            <span className="nc-grid-item-name">{label}</span>
            <span className="nc-grid-item-pct">{pct}%</span>
          </div>
          <div className="nc-grid-bar">
            <div className="nc-grid-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--nc-accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Period + date navigation header ──────────────────────────────────────────
function PeriodNav({ period, anchor, onPeriodChange, onShift }) {
  const { label, sub } = periodLabel(period, anchor);
  const atCurrent = isCurrentPeriod(period, anchor);
  return (
    <div style={{ background: 'var(--nc-surf)', paddingTop: 10 }}>
      <div className="nc-segment" style={{ margin: '0 16px' }}>
        {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([id, name]) => (
          <button
            key={id}
            className={`nc-seg-btn${period === id ? ' active' : ''}`}
            onClick={() => onPeriodChange(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="nc-date-nav" style={{ background: 'transparent' }}>
        <button className="nc-date-nav-btn" onClick={() => onShift(-1)}>
          <ChevronLeft size={20} />
        </button>
        <div className="nc-date-center">
          <div className="nc-date-label">
            {label}
            {period === 'day' && atCurrent && <span className="nc-today-dot" />}
          </div>
          <div className="nc-date-sub">{sub}</div>
        </div>
        <button className="nc-date-nav-btn" onClick={() => onShift(1)} disabled={atCurrent}>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

// ── Main DataTab ──────────────────────────────────────────────────────────────
export default function DataTab() {
  const { profile, dataVersion } = useNutriCore();
  const [period, setPeriod] = useState('day');       // 'day' | 'week' | 'month'
  const [anchor, setAnchor] = useState(todayStr());  // any date inside the period
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState({ kcal: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
  const [streak, setStreak] = useState(0);
  const [gym, setGym] = useState({ kcal: 0, minutes: 0, workouts: 0, byDate: {} });
  const [waterByDate, setWaterByDate] = useState({});
  const [loading, setLoading] = useState(true);

  const isDay = period === 'day';
  const isToday = isDay && anchor === todayStr();
  const { start, end } = getPeriodRange(period, anchor);

  // One range query per store; re-fetch when the selected period/date moves or
  // when diary data changes elsewhere (dataVersion).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { start, end } = getPeriodRange(period, anchor);
      const wantStreak = period === 'day' && anchor === todayStr();
      const [ents, gls, gymRange, water, str] = await Promise.all([
        getDiaryForRange(start, end),
        getGoalsForDate(period === 'day' ? anchor : todayStr()),
        getGymCaloriesForRange(start, end, profile?.weightKg),
        getWaterForRange(start, end),
        wantStreak ? getLoggingStreak() : Promise.resolve(0),
      ]);
      if (cancelled) return;
      setEntries(ents);
      setGoals(gls || { kcal: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
      setStreak(str);
      setGym(gymRange);
      setWaterByDate(water);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [dataVersion, profile, period, anchor]);

  const loggedDays = useMemo(() => new Set(entries.map(e => e.date)).size, [entries]);
  const rawTotals = useMemo(() => computeTotals(entries), [entries]);
  // Week/Month show average-per-logged-day amounts against the same daily goals.
  const totals = useMemo(
    () => (isDay || loggedDays === 0 ? rawTotals : scaleTotals(rawTotals, 1 / loggedDays)),
    [rawTotals, isDay, loggedDays]
  );
  const tdeeData = useMemo(() => (profile ? computeTDEE(profile) : null), [profile]);
  const dri = useMemo(() => getDRI(profile), [profile]);
  const scores = useMemo(() => computeScores(totals, goals, dri), [totals, goals, dri]);

  if (loading) return <div className="nc-loader">Loading…</div>;

  const daysInPeriod = countDays(start, end);
  const periodName = period === 'week' ? 'week' : 'month';

  // Empty aggregate period — show the nav plus a clear empty state.
  if (!isDay && loggedDays === 0) {
    return (
      <AppScreen noPadding>
        <PeriodNav period={period} anchor={anchor} onPeriodChange={setPeriod}
          onShift={dir => setAnchor(a => shiftPeriod(period, a, dir))} />
        <div className="nc-data-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Calendar size={28} color="var(--nc-text3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--nc-text)' }}>
            No food logged this {periodName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--nc-text3)', marginTop: 4 }}>
            Log meals in the Diary to see {period === 'week' ? 'weekly' : 'monthly'} averages here.
          </div>
        </div>
      </AppScreen>
    );
  }

  const tdee = tdeeData?.tdee || goals.kcal;
  const bmr = tdeeData?.bmr || Math.round(tdee / 1.55);
  // Fold gym calories into activity/expenditure — same as the diary's Energy slide.
  // Aggregate modes use the average gym kcal per elapsed day of the period.
  const gymKcal = isDay ? gym.kcal : gym.kcal / elapsedDays(start, end);
  // Water: the selected day's total, or the average over days with water logged.
  const waterDays = Object.keys(waterByDate).length;
  const waterMl = isDay
    ? (waterByDate[anchor] || 0)
    : (waterDays ? Math.round(Object.values(waterByDate).reduce((a, b) => a + b, 0) / waterDays) : 0);
  const activity = Math.max(0, tdee - bmr) + gymKcal;
  const expenditure = bmr + activity;
  const consumed = totals.kcal;
  const deficit = Math.max(0, expenditure - consumed);
  const surplus = Math.max(0, consumed - expenditure);
  const netCarbs = Math.max(0, totals.carbsG - totals.fiberG);
  const netCarbsGoal = Math.max(0, goals.carbsG - (goals.fiberG || 0));

  const expenditureData = [
    { value: bmr, color: '#7C3AED' },
    { value: Math.max(1, activity), color: '#06B6D4' },
  ];

  return (
    <AppScreen noPadding>
      {/* Period + date navigation */}
      <PeriodNav period={period} anchor={anchor} onPeriodChange={setPeriod}
        onShift={dir => setAnchor(a => shiftPeriod(period, a, dir))} />

      {/* Streak — only on today's day report */}
      {isToday && (
        <div className="nc-streak-card">
          <Calendar size={28} color={streak > 0 ? 'var(--nc-accent)' : 'var(--nc-text3)'} />
          <div className="nc-streak-num" style={{ color: streak > 0 ? 'var(--nc-accent)' : 'var(--nc-text)' }}>
            {streak}
          </div>
          <div className="nc-streak-label">day streak</div>
          <div className="nc-streak-sub">
            {streak === 0 ? 'Start logging to begin your streak!' : `${streak} consecutive day${streak !== 1 ? 's' : ''} logged`}
          </div>
        </div>
      )}

      {/* Aggregate period summary */}
      {!isDay && (
        <div className="nc-data-card">
          <div className="nc-data-card-header">
            {period === 'week' ? 'Weekly' : 'Monthly'} Summary
          </div>
          {[
            { label: 'Days logged',  val: `${loggedDays} / ${daysInPeriod} days` },
            { label: 'Avg calories', val: `${Math.round(consumed)} kcal/day` },
            { label: 'Avg protein / carbs / fat', val: `${Math.round(totals.proteinG)} / ${Math.round(totals.carbsG)} / ${Math.round(totals.fatG)} g` },
            { label: 'Workouts',     val: `${gym.workouts} (${gym.minutes} min)` },
          ].map(({ label, val }) => (
            <div key={label} className="nc-deficit-row">
              <span className="nc-deficit-label">{label}</span>
              <span className="nc-deficit-val">{val}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--nc-text3)', marginTop: 8, lineHeight: 1.4 }}>
            Averages are per day over the {loggedDays} logged day{loggedDays !== 1 ? 's' : ''}.
            Water avg is over days with water logged.
          </div>
        </div>
      )}

      {/* Deficit / Expenditure / Consumed row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 12px' }}>
        {/* Consumed card */}
        <div className="nc-data-card" style={{ flex: 1, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--nc-text3)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 8 }}>
            CONSUMED{!isDay && ' / DAY'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--nc-text)' }}>{Math.round(consumed)}</div>
              <div style={{ fontSize: 11, color: 'var(--nc-text3)' }}>kcal</div>
            </div>
            <PieChart width={54} height={54} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie data={[
                { value: totals.proteinG * 4, color: 'var(--nc-accent)' },
                { value: totals.carbsG * 4, color: 'var(--nc-a2)' },
                { value: totals.fatG * 9, color: 'var(--nc-a3)' },
                { value: Math.max(1, consumed === 0 ? 1 : 0), color: 'var(--nc-neutral)' },
              ].filter(d => d.value > 0)}
                cx={27} cy={27} innerRadius={16} outerRadius={25}
                startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                {[0, 1, 2, 3].map(i => (
                  <Cell key={i} fill={['var(--nc-accent)', 'var(--nc-a2)', 'var(--nc-a3)', 'var(--nc-neutral)'][i]} />
                ))}
              </Pie>
            </PieChart>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { label: 'Protein', val: totals.proteinG, color: 'var(--nc-accent)' },
              { label: 'Carbs',   val: totals.carbsG,   color: 'var(--nc-a2)' },
              { label: 'Fat',     val: totals.fatG,      color: 'var(--nc-a3)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--nc-text2)', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--nc-text)', fontWeight: 600 }}>
                  {val > 0 ? `${val.toFixed(1)} g` : '— —'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expenditure card */}
        <div className="nc-data-card" style={{ flex: 1, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--nc-text3)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 8 }}>
            EXPENDITURE{!isDay && ' / DAY'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--nc-text)' }}>{Math.round(expenditure)}</div>
              <div style={{ fontSize: 11, color: 'var(--nc-text3)' }}>kcal</div>
            </div>
            <PieChart width={54} height={54} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie data={expenditureData} cx={27} cy={27}
                innerRadius={16} outerRadius={25}
                startAngle={90} endAngle={-270} paddingAngle={1} dataKey="value" strokeWidth={0}>
                {expenditureData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { label: 'BMR', val: bmr, color: '#7C3AED' },
              { label: 'Activity', val: activity, color: '#06B6D4' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--nc-text2)', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--nc-text)', fontWeight: 600 }}>{Math.round(val)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deficit card */}
      <div className="nc-data-card">
        <div className="nc-data-card-header">
          {isDay ? '' : 'Avg Daily '}{surplus > 0 ? 'Surplus' : 'Deficit'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {[
              { label: 'Expenditure', val: `${Math.round(expenditure)} kcal`, bold: true },
              { label: 'Consumed',    val: `− ${Math.round(consumed)} kcal` },
              { label: surplus > 0 ? 'Surplus' : 'Deficit', val: `${Math.round(surplus || deficit)} kcal`, bold: true },
            ].map(({ label, val, bold }) => (
              <div key={label} className="nc-deficit-row">
                <span className="nc-deficit-label">{label}</span>
                <span className="nc-deficit-val" style={bold ? {} : { fontWeight: 400, color: 'var(--nc-text2)' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
            <svg width="70" height="70" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="35" cy="35" r="28" fill="none" stroke="var(--nc-neutral)" strokeWidth="8" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: String(Math.round(surplus || deficit)).replace('-', '').length >= 4 ? 13 : 16, fontWeight: 800, color: 'var(--nc-text)', lineHeight: 1.1 }}>{Math.round(surplus || deficit)}</div>
              <div style={{ fontSize: 10, color: 'var(--nc-text3)' }}>kcal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Macronutrient Targets */}
      <Section title="Macronutrient Targets">
        <div style={{ padding: '0 14px 10px' }}>
          {!isDay && (
            <div style={{ fontSize: 11, color: 'var(--nc-text3)', marginBottom: 8 }}>
              Daily averages over {loggedDays} logged day{loggedDays !== 1 ? 's' : ''} vs daily targets
            </div>
          )}
          {[
            { label: 'Energy',    consumed: Math.round(consumed), goal: goals.kcal,    unit: 'kcal', color: 'var(--nc-text)' },
            { label: 'Protein',   consumed: totals.proteinG,      goal: goals.proteinG, unit: 'g',    color: 'var(--nc-accent)' },
            { label: 'Net Carbs', consumed: netCarbs,             goal: netCarbsGoal,  unit: 'g',    color: 'var(--nc-a2)' },
            { label: 'Fat',       consumed: totals.fatG,          goal: goals.fatG,    unit: 'g',    color: 'var(--nc-a3)' },
          ].map(({ label, consumed: c, goal, unit, color }) => {
            const pct = goal > 0 ? Math.min(100, Math.round((c / goal) * 100)) : 0;
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--nc-text3)' }}>
                    {c > 0 ? `${typeof c === 'number' ? c.toFixed(c >= 10 ? 1 : 2) : c}` : 'No Data'} / {goal} {unit}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--nc-text3)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--nc-neutral)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Highlighted Targets */}
      <Section title="Highlighted Targets">
        <ScoreGrid items={[
          { label: 'Fiber',      pct: Math.min(100, Math.round((totals.fiberG     || 0) / dri.fiberG     * 100)) },
          { label: 'Vitamin C',  pct: Math.min(100, Math.round((totals.vitaminCMg || 0) / dri.vitaminCMg * 100)) },
          { label: 'Iron',       pct: Math.min(100, Math.round((totals.ironMg     || 0) / dri.ironMg     * 100)) },
          { label: 'B12',        pct: Math.min(100, Math.round((totals.b12Mcg     || 0) / dri.b12Mcg     * 100)) },
          { label: 'Calcium',    pct: Math.min(100, Math.round((totals.calciumMg  || 0) / dri.calciumMg  * 100)) },
          { label: 'Folate',     pct: Math.min(100, Math.round((totals.folateMcg  || 0) / dri.folateMcg  * 100)) },
          { label: 'Vitamin A',  pct: Math.min(100, Math.round((totals.vitaminAMcg|| 0) / dri.vitaminAMcg* 100)) },
          { label: 'Potassium',  pct: Math.min(100, Math.round((totals.potassiumMg|| 0) / dri.potassiumMg* 100)) },
        ]} />
      </Section>

      {/* Nutrition Scores */}
      <Section title="Nutrition Scores">
        <ScoreGrid items={[
          { label: 'All Targets',    pct: scores.allTargets },
          { label: 'Immune Support', pct: scores.immuneSupport },
          { label: 'Vitamins',       pct: scores.vitamins },
          { label: 'Antioxidants',   pct: scores.antioxidants },
          { label: 'Minerals',       pct: scores.minerals },
          { label: 'Bone Health',    pct: scores.boneHealth },
          { label: 'Electrolytes',   pct: scores.electrolytes },
          { label: 'Metabolism',     pct: scores.metabolismSupport },
        ]} />
      </Section>

      {/* Complete Nutrient Summary */}
      <Section title="Complete Nutrient Summary" defaultOpen={false}>
        {!isDay && (
          <div style={{ fontSize: 11, color: 'var(--nc-text3)', padding: '0 14px 4px' }}>
            Daily averages over {loggedDays} logged day{loggedDays !== 1 ? 's' : ''} vs daily targets
          </div>
        )}
        <div className="nc-nutrient-cat">
          <div className="nc-nutrient-cat-title">General</div>
          <NutrientRow label="Energy (Consumed)" amount={Math.round(consumed)} unit="kcal" goal={goals.kcal} color="var(--nc-text)" />
          <NutrientRow label="Water"    amount={waterMl} unit="mL" goal={2000} />
          <NutrientRow label="Alcohol"  amount={totals.alcoholG} unit="g" goal={0} />
          <NutrientRow label="Caffeine" amount={totals.caffeineMg} unit="mg" goal={400} />
        </div>
        <div className="nc-nutrient-cat">
          <div className="nc-nutrient-cat-title">Vitamins</div>
          <NutrientRow label="B1 (Thiamine)"    amount={totals.thiamineMg}   unit="mg"  goal={dri.thiamineMg} />
          <NutrientRow label="B2 (Riboflavin)"  amount={totals.riboflavinMg} unit="mg"  goal={dri.riboflavinMg} />
          <NutrientRow label="B3 (Niacin)"      amount={totals.niacinMg}     unit="mg"  goal={dri.niacinMg} />
          <NutrientRow label="B6 (Pyridoxine)"  amount={totals.b6Mg}         unit="mg"  goal={dri.b6Mg} />
          <NutrientRow label="B5 (Pantothenic Acid)" amount={totals.b5Mg}    unit="mg"  goal={5} />
          <NutrientRow label="B12 (Cobalamin)"  amount={totals.b12Mcg}       unit="mcg" goal={dri.b12Mcg} />
          <NutrientRow label="Folate"           amount={totals.folateMcg}    unit="mcg" goal={dri.folateMcg} />
          <NutrientRow label="Choline"          amount={totals.cholineMg}    unit="mg"  goal={550} />
          <NutrientRow label="Vitamin A"        amount={totals.vitaminAMcg}  unit="mcg" goal={dri.vitaminAMcg} />
          <NutrientRow label="Vitamin C"        amount={totals.vitaminCMg}   unit="mg"  goal={dri.vitaminCMg} />
          <NutrientRow label="Vitamin D"        amount={totals.vitaminDMcg}  unit="mcg" goal={dri.vitaminDMcg} />
          <NutrientRow label="Vitamin E"        amount={totals.vitaminEMg}   unit="mg"  goal={dri.vitaminEMg} />
          <NutrientRow label="Vitamin K"        amount={totals.vitaminKMcg}  unit="mcg" goal={dri.vitaminKMcg} />
        </div>
        <div className="nc-nutrient-cat">
          <div className="nc-nutrient-cat-title">Minerals</div>
          <NutrientRow label="Calcium"   amount={totals.calciumMg}   unit="mg"  goal={dri.calciumMg} />
          <NutrientRow label="Copper"    amount={totals.copperMg}    unit="mg"  goal={dri.copperMg} />
          <NutrientRow label="Iron"      amount={totals.ironMg}      unit="mg"  goal={dri.ironMg} />
          <NutrientRow label="Magnesium" amount={totals.magnesiumMg} unit="mg"  goal={dri.magnesiumMg} />
          <NutrientRow label="Manganese" amount={totals.manganeseMg} unit="mg"  goal={2.3} />
          <NutrientRow label="Phosphorus" amount={totals.phosphorusMg} unit="mg" goal={700} />
          <NutrientRow label="Potassium" amount={totals.potassiumMg} unit="mg"  goal={dri.potassiumMg} />
          <NutrientRow label="Selenium"  amount={totals.seleniumMcg} unit="mcg" goal={dri.seleniumMcg} />
          <NutrientRow label="Sodium"    amount={totals.sodiumMg}    unit="mg"  goal={dri.sodiumMg} />
          <NutrientRow label="Zinc"      amount={totals.zincMg}      unit="mg"  goal={dri.zincMg} />
        </div>
        <div className="nc-nutrient-cat">
          <div className="nc-nutrient-cat-title">Protein</div>
          <NutrientRow label="Protein" amount={totals.proteinG} unit="g" goal={goals.proteinG} color="var(--nc-accent)" />
          {[['Cystine','cystineG'],['Histidine','histidineG'],['Isoleucine','isoleucineG'],['Leucine','leucineG'],
            ['Lysine','lysineG'],['Methionine','methionineG'],['Phenylalanine','phenylalanineG'],['Threonine','threonineG'],
            ['Tryptophan','tryptophanG'],['Tyrosine','tyrosineG'],['Valine','valineG']]
            .map(([n, k]) => <NutrientRow key={n} label={n} amount={totals[k]} unit="g" goal={0} indent={1} />)}
        </div>
        <div className="nc-nutrient-cat">
          <div className="nc-nutrient-cat-title">Lipids</div>
          <NutrientRow label="Fat" amount={totals.fatG} unit="g" goal={goals.fatG} color="var(--nc-a3)" />
          <NutrientRow label="Fat (Saturated)"       amount={totals.satFatG}   unit="g" goal={0} indent={1} />
          <NutrientRow label="Fat (Trans)"           amount={totals.transFatG} unit="g" goal={0} indent={1} />
          <NutrientRow label="Fat (Monounsaturated)" amount={totals.monoFatG} unit="g" goal={0} indent={1} />
          <NutrientRow label="Fat (Polyunsaturated)" amount={totals.polyFatG} unit="g" goal={0} indent={1} />
          <NutrientRow label="Omega-3" amount={totals.omega3G} unit="g" goal={dri.omega3G} indent={1} />
          <NutrientRow label="Omega-6" amount={totals.omega6G} unit="g" goal={dri.omega6G} indent={1} />
          <NutrientRow label="Cholesterol" amount={totals.cholesterolMg} unit="mg" goal={300} indent={1} />
        </div>
        <div className="nc-nutrient-cat" style={{ paddingBottom: 12 }}>
          <div className="nc-nutrient-cat-title">Carbohydrates</div>
          <NutrientRow label="Carbs (Total)" amount={totals.carbsG} unit="g" goal={goals.carbsG} color="var(--nc-a2)" />
          <NutrientRow label="Net Carbs"     amount={netCarbs}       unit="g" goal={netCarbsGoal} color="var(--nc-a2)" indent={1} />
          <NutrientRow label="Fiber"         amount={totals.fiberG}  unit="g" goal={dri.fiberG} indent={1} />
          {['Fiber (Insoluble)','Fiber (Soluble)']
            .map(n => <NutrientRow key={n} label={n} amount={0} unit="g" goal={0} indent={2} />)}
          <NutrientRow label="Sugars"        amount={totals.sugarG}      unit="g" goal={0} indent={2} />
          <NutrientRow label="Added Sugars"  amount={totals.addedSugarG} unit="g" goal={0} indent={2} />
        </div>
      </Section>

      {/* Nutrient Balance — day mode only; ratio gauges over averaged data add noise */}
      {isDay && (
      <Section title="Nutrient Balance" defaultOpen={false}>
        <div className="nc-gauges-grid">
          <Gauge label="Omega-6 : Omega-3"  value={totals.omega3G > 0 ? +(totals.omega6G / totals.omega3G).toFixed(3) : 0} max={25} />
          <Gauge label="Zinc : Copper"      value={totals.copperMg > 0 ? +(totals.zincMg / totals.copperMg).toFixed(3) : 0} max={20} />
          <Gauge label="Potassium : Sodium" value={totals.sodiumMg > 0 ? +(totals.potassiumMg / totals.sodiumMg).toFixed(3) : 0} max={12} />
          <Gauge label="Ca : Magnesium"     value={totals.magnesiumMg > 0 ? +(totals.calciumMg / totals.magnesiumMg).toFixed(3) : 0} max={6} />
        </div>
        <div style={{ padding: '4px 14px 12px' }}>
          <p style={{ fontSize: 11, color: 'var(--nc-text3)', margin: 0, lineHeight: 1.5 }}>
            Nutrient balance ratios require detailed micronutrient data not yet available in the food database. These will populate as richer food data is added.
          </p>
        </div>
      </Section>
      )}

      <div style={{ height: 8 }} />
    </AppScreen>
  );
}
