import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppScreen, ProgressRing } from '../ui';
import { ChevronLeft, ChevronRight, ChevronRight as ChevRight, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getDiaryForDate, getMeals, getGoalsForDate,
  getWaterForDate, addWater, removeLastWater,
  addDiaryEntry, deleteDiaryEntry, updateDiaryEntry,
  copyEntriesToDate, saveGoalsForDate, deleteGoalsForDate, hasDateGoals,
} from './db';
import { useNutriCore } from './NCContext';
import { Copy, SlidersHorizontal } from 'lucide-react';
import { getGymCaloriesForDate } from '../utils/gymCalories';
import DayGoalModal from './DayGoalModal';
import { computeTotals, entryKcal, entryToNutrients, fmt } from './nutrition';
import { computeTDEE } from './tdee';
import { getDRI, computeScores } from './dri';
import { mlToDisplayVal, waterUnitLabel } from './units';
import { parseDate, prevDay, nextDay, todayStr } from '../utils/dates';
import FoodPickerModal from './FoodPickerModal';
import ServingEditorModal from './ServingEditorModal';

// Rebuild a food-shaped object from a logged diary entry (entry stores per-100 g food* fields).
function entryToFood(e) {
  return {
    id: e.foodId, name: e.foodName, brand: null, category: e.foodCategory,
    // Serving info persisted on newer entries; old entries fall back to per-100 g.
    servingSizeG: e.foodServingSizeG || 100,
    servingUnit: e.foodServingUnit || undefined,
    servingSizes: e.foodServingSizes || undefined,
    // Per-100 g nutrients (kcal, proteinG, …); fields missing on old entries → 0.
    ...entryToNutrients(e),
  };
}

const CATEGORY_EMOJI = {
  protein: '🥩', dairy: '🥛', grain: '🌾', vegetable: '🥦',
  fruit: '🍎', fat: '🫒', beverage: '☕', supplement: '💊', other: '🟤',
};

function formatDateLabel(s) {
  const t = todayStr();
  const yes = prevDay(t);
  if (s === t) return 'Today';
  if (s === yes) return 'Yesterday';
  const d = parseDate(s);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function SmallRing({ value, total, color = 'var(--nc-accent)', size = 88, sw = 8 }) {
  return <ProgressRing value={value} total={total} color={color} size={size} strokeWidth={sw} trackColor="var(--nc-neutral)" />;
}

// ── Expenditure donut (pure SVG, 2 arcs) ─────────────────────────────────
function ExpDonut({ bmr, activity }) {
  const CX = 44, CY = 44, R = 36;
  const total = bmr + activity;
  if (total === 0) return (
    <svg width="88" height="88" style={{ display: 'block' }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--nc-neutral)" strokeWidth={8} />
    </svg>
  );

  function pt(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  const bPct = bmr / total;
  const aPct = 1 - bPct;
  const bEnd = pt(Math.min(359.99, bPct * 360));
  const bStart = pt(0);
  const aEnd = pt(359.99);

  return (
    <svg width="88" height="88" style={{ display: 'block' }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--nc-neutral)" strokeWidth={8} />
      <path
        d={`M ${bStart.x.toFixed(2)} ${bStart.y.toFixed(2)} A ${R} ${R} 0 ${bPct > 0.5 ? 1 : 0} 1 ${bEnd.x.toFixed(2)} ${bEnd.y.toFixed(2)}`}
        fill="none" stroke="#7C3AED" strokeWidth={8} strokeLinecap="butt" />
      {aPct > 0.005 && (
        <path
          d={`M ${bEnd.x.toFixed(2)} ${bEnd.y.toFixed(2)} A ${R} ${R} 0 ${aPct > 0.5 ? 1 : 0} 1 ${aEnd.x.toFixed(2)} ${aEnd.y.toFixed(2)}`}
          fill="none" stroke="#06B6D4" strokeWidth={8} strokeLinecap="butt" />
      )}
    </svg>
  );
}

// ── Ring cell (ring + overlay text) ───────────────────────────────────────
function RingCell({ label, value, total, color, children }) {
  return (
    <div className="nc-energy-circ">
      <div style={{ position: 'relative', width: 88, height: 88 }}>
        {children}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div className="nc-energy-circ-val">{Math.round(value)}</div>
          <div className="nc-energy-circ-unit">kcal</div>
        </div>
      </div>
      <div className="nc-energy-circ-lbl">{label}</div>
    </div>
  );
}

// ── Slide 0: Energy Summary ────────────────────────────────────────────────
function EnergySlide({ totals, goals, profile, activeKcal = 0, adaptive }) {
  const tdeeData = profile ? computeTDEE(profile) : null;
  const baseTdee = tdeeData?.tdee || goals.kcal;
  const bmr = tdeeData?.bmr || Math.round(baseTdee / 1.55);
  // Adaptive expenditure is observed from intake + weight trend, so training
  // calories are already baked into it — re-adding gym kcal would double count.
  // The formula fallback keeps the gym fold-in (the cross-app integration).
  const useAdaptive = !!adaptive?.available;
  const activity = useAdaptive
    ? Math.max(0, adaptive.tdee - bmr)
    : Math.max(0, baseTdee - bmr) + activeKcal;
  const expenditure = bmr + activity;
  const consumed = totals.kcal;
  const deficit = Math.max(0, expenditure - consumed);

  return (
    <div className="nc-energy-slide">
      <div className="nc-slide-label" style={{ padding: '6px 12px 2px' }}>
        ENERGY SUMMARY{useAdaptive ? ' · ADAPTIVE' : activeKcal > 0 ? ` · +${activeKcal} from training` : ''}
      </div>
      <div className="nc-energy-row">
        <RingCell label="Consumed" value={consumed}>
          <SmallRing value={consumed} total={expenditure} color="var(--nc-accent)" />
        </RingCell>
        <RingCell label="Expenditure" value={expenditure}>
          <ExpDonut bmr={bmr} activity={activity} />
        </RingCell>
        <RingCell label="Deficit" value={deficit}>
          <SmallRing value={deficit} total={expenditure} color="var(--nc-text3)" />
        </RingCell>
      </div>
    </div>
  );
}

// ── Slide 1: Targets ───────────────────────────────────────────────────────
function TargetBar({ label, consumed, goal, unit = 'g', color }) {
  const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  return (
    <div className="nc-target-row">
      <div className="nc-target-name" style={{ color }}>{label}</div>
      <div className="nc-target-val">{fmt(consumed, 1)}/{fmt(goal, 0)}{unit}</div>
      <div className="nc-target-bar-wrap">
        <div className="nc-target-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="nc-target-pct">{pct}%</div>
    </div>
  );
}

function TargetsSlide({ totals, goals }) {
  const netCarbs = Math.max(0, totals.carbsG - totals.fiberG);
  const netCarbsGoal = Math.max(1, goals.carbsG - (goals.fiberG || 0));
  return (
    <div style={{ paddingBottom: 4 }}>
      <div className="nc-slide-label" style={{ padding: '6px 12px 2px' }}>TARGETS</div>
      <TargetBar label="Energy"    consumed={totals.kcal}     goal={goals.kcal}     unit="k" color="var(--nc-text)" />
      <TargetBar label="Protein"   consumed={totals.proteinG}  goal={goals.proteinG}  color="var(--nc-accent)" />
      <TargetBar label="Net Carbs" consumed={netCarbs}         goal={netCarbsGoal}   color="var(--nc-a2)" />
      <TargetBar label="Fat"       consumed={totals.fatG}      goal={goals.fatG}     color="var(--nc-a3)" />
    </div>
  );
}

// ── 2-col grid item ────────────────────────────────────────────────────────
function GridItem({ label, pct }) {
  return (
    <div className="nc-grid-item">
      <div className="nc-grid-item-top">
        <span className="nc-grid-item-name">{label}</span>
        <span className="nc-grid-item-pct">{pct}%</span>
      </div>
      <div className="nc-grid-bar">
        <div className="nc-grid-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--nc-accent)' }} />
      </div>
    </div>
  );
}

// ── Slide 2: Highlighted Nutrients ─────────────────────────────────────────
function HighlightedSlide({ totals, dri }) {
  function p(a, t) { return t > 0 ? Math.min(100, Math.round((a || 0) / t * 100)) : 0; }
  return (
    <div>
      <div className="nc-slide-label" style={{ padding: '6px 12px 4px' }}>HIGHLIGHTED NUTRIENTS</div>
      <div className="nc-two-col">
        <GridItem label="Fiber"     pct={p(totals.fiberG,      dri.fiberG)} />
        <GridItem label="Vitamin C" pct={p(totals.vitaminCMg,  dri.vitaminCMg)} />
        <GridItem label="Iron"      pct={p(totals.ironMg,      dri.ironMg)} />
        <GridItem label="B12"       pct={p(totals.b12Mcg,      dri.b12Mcg)} />
        <GridItem label="Calcium"   pct={p(totals.calciumMg,   dri.calciumMg)} />
        <GridItem label="Folate"    pct={p(totals.folateMcg,   dri.folateMcg)} />
        <GridItem label="Vitamin A" pct={p(totals.vitaminAMcg, dri.vitaminAMcg)} />
        <GridItem label="Potassium" pct={p(totals.potassiumMg, dri.potassiumMg)} />
      </div>
    </div>
  );
}

// ── Slide 3: Nutrition Scores ──────────────────────────────────────────────
function ScoresSlide({ totals, goals, dri }) {
  const scores = computeScores(totals, goals, dri);
  return (
    <div>
      <div className="nc-slide-label" style={{ padding: '6px 12px 4px' }}>NUTRITION SCORES</div>
      <div className="nc-two-col">
        <GridItem label="All Targets"    pct={scores.allTargets} />
        <GridItem label="Immune Support" pct={scores.immuneSupport} />
        <GridItem label="Vitamins"       pct={scores.vitamins} />
        <GridItem label="Antioxidants"   pct={scores.antioxidants} />
        <GridItem label="Minerals"       pct={scores.minerals} />
        <GridItem label="Bone Health"    pct={scores.boneHealth} />
        <GridItem label="Electrolytes"   pct={scores.electrolytes} />
        <GridItem label="Metabolism"     pct={scores.metabolismSupport} />
      </div>
    </div>
  );
}

// ── Carousel ───────────────────────────────────────────────────────────────
const SLIDE_COUNT = 4;

function Carousel({ totals, goals, profile, activeKcal = 0, adaptive }) {
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef(null);
  const dri = getDRI(profile);

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && slide < SLIDE_COUNT - 1) setSlide(s => s + 1);
      if (dx > 0 && slide > 0) setSlide(s => s - 1);
    }
    touchStartX.current = null;
  }

  return (
    <div className="nc-carousel-wrap">
      <div className="nc-carousel-with-arrows">
        {/* Left arrow */}
        <button className="nc-car-arrow"
          style={{ visibility: slide > 0 ? 'visible' : 'hidden' }}
          onClick={() => setSlide(s => s - 1)}>
          <ChevronLeft size={30} />
        </button>

        {/* Slides */}
        <div className="nc-carousel-overflow"
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="nc-carousel-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            <div className="nc-carousel-slide">
              <EnergySlide totals={totals} goals={goals} profile={profile} activeKcal={activeKcal} adaptive={adaptive} />
            </div>
            <div className="nc-carousel-slide">
              <TargetsSlide totals={totals} goals={goals} />
            </div>
            <div className="nc-carousel-slide">
              <HighlightedSlide totals={totals} dri={dri} />
            </div>
            <div className="nc-carousel-slide">
              <ScoresSlide totals={totals} goals={goals} dri={dri} />
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <button className="nc-car-arrow"
          style={{ visibility: slide < SLIDE_COUNT - 1 ? 'visible' : 'hidden' }}
          onClick={() => setSlide(s => s + 1)}>
          <ChevronRight size={30} />
        </button>
      </div>

      {/* Dots */}
      <div className="nc-carousel-dots">
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button key={i} className={`nc-carousel-dot${slide === i ? ' active' : ''}`}
            onClick={() => setSlide(i)} />
        ))}
      </div>
    </div>
  );
}

// ── Water Cups ─────────────────────────────────────────────────────────────
const CUPS_GOAL = 8;

function Cup({ filled, isNext, onClick }) {
  // Wide tumbler with an elliptical opening (Cronometer-style). The geometry itself is
  // wide (viewBox aspect ≈ render aspect) so it's never non-uniformly stretched, and the
  // wide bowl leaves the "+" plenty of room.
  const line = filled ? 'var(--nc-a2)' : 'var(--nc-text3)';
  return (
    <svg onClick={onClick} viewBox="0 0 32 34" width="32" height="34"
      style={{ cursor: onClick ? 'pointer' : 'default', flexShrink: 0, display: 'block' }}>
      {/* glass body — wide opening, gentle taper toward the base */}
      <path d="M5 4.5 H27 L24.2 29 Q23.8 31.4 21 31.4 H11 Q8.2 31.4 7.8 29 Z"
        fill={filled ? 'var(--nc-a2)' : 'none'}
        stroke={line} strokeWidth="1.6" strokeLinejoin="round" />
      {/* rim opening */}
      <ellipse cx="16" cy="4.5" rx="11" ry="2.1"
        fill={filled ? 'var(--nc-a2)' : 'var(--nc-surf)'}
        stroke={line} strokeWidth="1.6" />
      {/* water-surface sheen on filled glasses */}
      {filled && <ellipse cx="16" cy="4.5" rx="11" ry="2.1" fill="#fff" opacity="0.16" />}
      {isNext && (
        <path d="M16 11 V21 M11 16 H21"
          stroke="var(--nc-accent)" strokeWidth="2.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

// One glass = a standard US cup = 8 fl oz (~237 ml); default goal is the classic 8 a day.
const GLASS_ML = 237;
const DEFAULT_WATER_GOAL_ML = 8 * GLASS_ML;

function WaterCups({ waterMl, waterGoalMl = DEFAULT_WATER_GOAL_ML, onAdd, onRemove, unitWater = 'ml' }) {
  const cups = Math.floor(waterMl / GLASS_ML);
  const [open, setOpen] = useState(true);
  const goalMl = waterGoalMl || DEFAULT_WATER_GOAL_ML;
  const pct = Math.min(1, waterMl / goalMl);
  const goalCups = Math.max(1, Math.round(goalMl / GLASS_ML));
  // Present water in whole 8-oz glasses so totals stay clean (e.g. 64 fl oz / 8 cups),
  // rather than the raw ml of a possibly-odd stored goal. ml stays exact.
  let displayVal, goal;
  if (unitWater === 'floz')     { displayVal = cups * 8;  goal = { value: goalCups * 8, label: 'fl oz' }; }
  else if (unitWater === 'cups'){ displayVal = cups;      goal = { value: goalCups,     label: 'cups' }; }
  else                          { displayVal = Math.round(waterMl); goal = { value: Math.round(goalMl), label: 'mL' }; }
  const iconCount = Math.max(goalCups, cups + 1);

  return (
    <div className="nc-water-section">
      <div className="nc-water-hdr" onClick={() => setOpen(o => !o)}>
        <div className="nc-water-hdr-left">
          <span className="nc-water-ttl">Water</span>
          <span className="nc-water-amount">{displayVal} / {goal.value} {goal.label}</span>
        </div>
        {open ? <ChevronUp size={16} color="var(--nc-text3)" /> : <ChevronDown size={16} color="var(--nc-text3)" />}
      </div>
      {open && (
        <>
          <div className="nc-cups-row">
            {Array.from({ length: iconCount }, (_, i) => (
              <Cup key={i}
                filled={i < cups}
                isNext={i === cups}
                onClick={i < cups ? onRemove : (i === cups ? onAdd : undefined)} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span className="nc-water-bar-label">Total Water</span>
            <div style={{ flex: 1, height: 4, background: 'var(--nc-neutral)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${pct * 100}%`, background: 'var(--nc-a2)', borderRadius: 2 }} />
            </div>
            <span className="nc-water-bar-label">{Math.round(pct * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Meal section ───────────────────────────────────────────────────────────
function MealSection({ meal, entries, onAddFood, onDeleteEntry, onEditEntry }) {
  const [open, setOpen] = useState(true);
  const mealEntries = entries.filter(e => e.mealId === meal.id);
  const mealKcal = mealEntries.reduce((s, e) => s + entryKcal(e), 0);

  return (
    <div className="nc-meal">
      <div className="nc-meal-header" onClick={() => setOpen(o => !o)}>
        <ChevRight size={14} className={`nc-meal-chevron${open ? ' open' : ''}`} />
        <span className="nc-meal-name">{meal.name}</span>
        {mealKcal > 0 && <span className="nc-meal-kcal">{Math.round(mealKcal)} kcal</span>}
      </div>
      {open && (
        <div className="nc-meal-body">
          {mealEntries.map(entry => {
            const kcal = entryKcal(entry);
            return (
              <div key={entry.id} className="nc-entry-row" onClick={() => onEditEntry(entry)}>
                <div className={`nc-entry-icon cat-${entry.foodCategory}`}>
                  {CATEGORY_EMOJI[entry.foodCategory] || '🍽️'}
                </div>
                <div className="nc-entry-body">
                  <div className="nc-entry-name">{entry.foodName}</div>
                  <div className="nc-entry-sub">{entry.unitLabel}</div>
                </div>
                <div className="nc-entry-kcal">{Math.round(kcal)}</div>
                <button className="nc-entry-del"
                  onClick={e => { e.stopPropagation(); onDeleteEntry(entry); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          <button className="nc-add-food-btn" onClick={() => onAddFood(meal.id)}>
            <Plus size={14} /> Add Food
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main DiaryScreen ───────────────────────────────────────────────────────
export default function DiaryScreen() {
  const { profile, bumpData, adaptive } = useNutriCore();
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState({ kcal: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
  const [waterMl, setWaterMl] = useState(0);
  const [gymKcal, setGymKcal] = useState(0);
  const [pickerMealId, setPickerMealId] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDayGoal, setShowDayGoal] = useState(false);
  const [dayOverride, setDayOverride] = useState(false);

  const reloadIdRef = useRef(0);
  const reload = useCallback(async (d) => {
    // Stale-request guard: rapid date navigation can resolve out of order, so only
    // the most recent reload (including its late gym-calories fetch) may set state.
    const reqId = ++reloadIdRef.current;
    const [ents, mls, gls, wMl, override] = await Promise.all([
      getDiaryForDate(d), getMeals(), getGoalsForDate(d), getWaterForDate(d), hasDateGoals(d),
    ]);
    if (reqId !== reloadIdRef.current) return;
    setEntries(ents);
    setMeals(mls);
    setGoals(gls || { kcal: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
    setWaterMl(wMl);
    setDayOverride(override);
    getGymCaloriesForDate(d, profile?.weightKg).then(g => {
      if (reqId === reloadIdRef.current) setGymKcal(g.kcal);
    });
    setLoading(false);
  }, [profile]);

  useEffect(() => { setLoading(true); reload(date); }, [date, reload]);

  const totals = useMemo(() => computeTotals(entries), [entries]);

  // Track the toast timer so overlapping toasts don't clear each other early and
  // nothing fires after unmount.
  const toastTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2100);
  }

  async function handleLog(entryData) {
    await addDiaryEntry({ ...entryData, date });
    setPickerMealId(null);
    await reload(date);
    bumpData();
    showToast('Added to diary');
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Delete "${entry.foodName}"?`)) return;
    await deleteDiaryEntry(entry.id);
    await reload(date);
    bumpData();
  }

  async function handleUpdateEntry(ed) {
    await updateDiaryEntry({ ...editEntry, ...ed, id: editEntry.id, date });
    setEditEntry(null);
    await reload(date);
    bumpData();
    showToast('Entry updated');
  }

  async function handleSaveDayGoal(g) {
    await saveGoalsForDate(date, g);
    setShowDayGoal(false);
    await reload(date);
    bumpData();
    showToast('Day targets updated');
  }

  async function handleResetDayGoal() {
    await deleteGoalsForDate(date);
    setShowDayGoal(false);
    await reload(date);
    bumpData();
    showToast('Reset to default goal');
  }

  async function handleCopyYesterday() {
    const y = prevDay(date);
    const yEntries = await getDiaryForDate(y);
    if (!yEntries.length) { showToast('Nothing logged yesterday'); return; }
    if (!window.confirm(`Copy ${yEntries.length} item${yEntries.length > 1 ? 's' : ''} from yesterday?`)) return;
    await copyEntriesToDate(yEntries, date);
    await reload(date);
    bumpData();
    showToast(`Copied ${yEntries.length} item${yEntries.length > 1 ? 's' : ''} from yesterday`);
  }

  async function handleAddWater() {
    await addWater(date, GLASS_ML);
    setWaterMl(w => w + GLASS_ML);
    bumpData();
  }

  async function handleRemoveWater() {
    if (waterMl <= 0) return;
    const removedMl = await removeLastWater(date);
    setWaterMl(w => Math.max(0, w - removedMl));
    bumpData();
  }

  const isToday = date === todayStr();

  if (loading) return <div className="nc-loader">Loading…</div>;

  return (
    <>
      <div className="nc-screen">
        {/* Date navigator */}
        <div className="nc-date-nav">
          <button className="nc-date-nav-btn" onClick={() => setDate(d => prevDay(d))}>
            <ChevronLeft size={20} />
          </button>
          <div className="nc-date-center">
            <div className="nc-date-label">
              {formatDateLabel(date)}
              {isToday && <span className="nc-today-dot" />}
            </div>
            <div className="nc-date-sub">
              {parseDate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <button className="nc-date-nav-btn" onClick={() => setDate(d => nextDay(d))} disabled={isToday}>
            <ChevronRight size={20} />
          </button>
          <button
            className="nc-date-nav-btn"
            title="Adjust day targets"
            onClick={() => setShowDayGoal(true)}
            style={{ color: dayOverride ? 'var(--nc-accent)' : undefined }}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Carousel */}
        <div className="nc-energy-banner" style={{ padding: 0 }}>
          <Carousel totals={totals} goals={goals} profile={profile} activeKcal={gymKcal} adaptive={adaptive} />
        </div>

        {/* Water */}
        <WaterCups waterMl={waterMl} waterGoalMl={profile?.waterGoalMl || DEFAULT_WATER_GOAL_ML}
          onAdd={handleAddWater} onRemove={handleRemoveWater}
          unitWater={profile?.unitWater === 'cups' ? 'ml' : (profile?.unitWater || 'ml')} />

        {/* Meals */}
        {meals.map(meal => (
          <MealSection key={meal.id} meal={meal} entries={entries}
            onAddFood={mealId => setPickerMealId(mealId)}
            onDeleteEntry={handleDelete}
            onEditEntry={entry => setEditEntry(entry)} />
        ))}

        <button
          onClick={handleCopyYesterday}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: 'calc(100% - 24px)', margin: '10px 12px 0', padding: '11px',
            background: 'var(--nc-surf)', border: '1px solid var(--nc-border)', borderRadius: 12,
            color: 'var(--nc-text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Copy size={15} /> Copy yesterday’s meals
        </button>

        <div style={{ height: 8 }} />
      </div>

      {pickerMealId != null && (
        <FoodPickerModal meals={meals} defaultMealId={pickerMealId}
          onLog={async (ed) => handleLog({ ...ed, mealId: ed.mealId || pickerMealId })}
          onClose={() => setPickerMealId(null)} />
      )}

      {editEntry && (
        <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditEntry(null); }}>
          <ServingEditorModal
            food={entryToFood(editEntry)}
            meals={meals}
            defaultMealId={editEntry.mealId}
            initialAmount={editEntry.unit != null ? editEntry.amount : editEntry.amountG}
            initialUnit={editEntry.unit || 'g'}
            ctaLabel="Save Changes"
            onLog={handleUpdateEntry}
            onBack={() => setEditEntry(null)} />
        </div>
      )}

      {showDayGoal && (
        <DayGoalModal
          date={date}
          current={goals}
          isOverride={dayOverride}
          onSave={handleSaveDayGoal}
          onReset={handleResetDayGoal}
          onClose={() => setShowDayGoal(false)}
        />
      )}

      {toast && <div className="nc-toast">{toast}</div>}
    </>
  );
}
