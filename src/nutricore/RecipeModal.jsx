import { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, X, ChevronLeft } from 'lucide-react';
import { saveFood, deleteFood, getGoalsForDate, getMeals, addDiaryEntry } from './db';
import { NUTRIENT_KEYS, foodToEntryFields } from './nutrition';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';
import BarcodeScanner from './BarcodeScanner';
import IngredientDetailModal from './IngredientDetailModal';
import FoodSearchModal from './FoodSearchModal';

const CATEGORY_EMOJI = {
  protein: '🥩', dairy: '🥛', grain: '🌾', vegetable: '🥦',
  fruit: '🍎', fat: '🫒', beverage: '☕', supplement: '💊', other: '🟤',
};
const MEAL_CATEGORIES = ['', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage', 'Side', 'Sauce / Dressing', 'Soup', 'Salad', 'Baked Goods', 'Other'];
const STEPS = ['ingredients', 'serving', 'details', 'summary'];

const round1 = v => +(Number(v) || 0).toFixed(1);

// Energy donut: protein/carbs/fat split with kcal in the centre.
function Donut({ kcal, p, c, f }) {
  const pK = p * 4, cK = c * 4, fK = f * 9;
  const sum = pK + cK + fK || 1;
  const pp = Math.round(pK / sum * 100), cp = Math.round(cK / sum * 100), fp = Math.max(0, 100 - pp - cp);
  const bg = `conic-gradient(#34d399 0 ${pp}%, #38bdf8 ${pp}% ${pp + cp}%, #fb923c ${pp + cp}% 100%)`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--nc-surf)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--nc-text)' }}>{Math.round(kcal)}</div>
          <div style={{ fontSize: 10, color: 'var(--nc-text3)' }}>kcal</div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {[['Protein', '#34d399', pp, p], ['Net Carbs', '#38bdf8', cp, c], ['Fat', '#fb923c', fp, f]].map(([l, col, pct, v]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--nc-text2)', flex: 1 }}>{l} ({pct}%)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nc-text)' }}>{round1(v)} g</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetRow({ label, value, target, unit }) {
  const pct = target > 0 ? Math.round(value / target * 100) : 0;
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--nc-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
        <span><b style={{ color: 'var(--nc-text)' }}>{label}</b> <span style={{ color: 'var(--nc-text2)' }}>- {round1(value)} / {target} {unit}</span></span>
        <span style={{ fontWeight: 600, color: 'var(--nc-text2)' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: 'var(--nc-surf2)', marginTop: 5 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, pct)}%`, background: 'var(--nc-accent)' }} />
      </div>
    </div>
  );
}

export default function RecipeModal({ meal = null, onClose, onSaved, onLog = null }) {
  const isEdit = !!meal;
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);

  const [step,        setStep]        = useState('ingredients');
  const [name,        setName]        = useState(meal?.name || '');
  const [ingredients, setIngredients] = useState(meal?.ingredients || []);
  const [servingMode, setServingMode] = useState(meal?.recipe?.mode || 'servings'); // 'servings' | 'weight'
  const [advanced,    setAdvanced]    = useState(meal?.recipe?.advanced || false);
  const [servings,    setServings]    = useState(
    meal?.recipe?.servings?.map(s => ({ name: s.name, value: String(s.value) }))
    || [{ name: meal?.servingUnit || 'serving', value: meal?.recipePct ? String(Math.max(1, Math.round(100 / meal.recipePct))) : '1' }]
  );
  const [category,    setCategory]    = useState(meal?.recipe?.category || '');
  const [notes,       setNotes]       = useState(meal?.recipe?.notes || '');
  const [summaryIdx,  setSummaryIdx]  = useState(0);

  const [saving,     setSaving]     = useState(false);
  const [showScan,   setShowScan]   = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [detailFood, setDetailFood] = useState(null);
  const [goals,      setGoals]      = useState(null);
  const [meals,      setMeals]      = useState([]);

  // Back steps backward through the wizard, and closes the modal from the first step.
  // (The nav stack re-traps Back after a non-closing handler, so each press steps once.)
  useBackClose(() => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]); else onClose();
  });
  useBackClose(() => setShowScan(false), showScan);   // scan overlay closes first

  useEffect(() => { getGoalsForDate(new Date().toISOString().slice(0, 10)).then(setGoals); }, []);
  useEffect(() => { getMeals().then(setMeals); }, []);

  function handleScanFound(food) {
    setShowScan(false);
    setDetailFood(food);
  }
  function addIngredientGrams(food, grams) {
    setIngredients(prev => {
      const ex = prev.find(i => i.food.id === food.id);
      if (ex) return prev.map(i => i.food.id === food.id ? { ...i, amountG: i.amountG + grams } : i);
      return [...prev, { food, amountG: grams }];
    });
  }
  function updateAmount(id, val) {
    setIngredients(prev => prev.map(i => i.food.id === id ? { ...i, amountG: Math.max(1, Number(val)) } : i));
  }
  function removeIngredient(id) { setIngredients(prev => prev.filter(i => i.food.id !== id)); }

  const totalWeight = ingredients.reduce((s, i) => s + i.amountG, 0);
  // Sum EVERY nutrient across ingredients (per-100 g values × grams/100) so the
  // saved recipe carries the full micronutrient profile of its parts.
  const totals = ingredients.reduce((acc, { food, amountG }) => {
    const s = amountG / 100;
    for (const k of NUTRIENT_KEYS) acc[k] += (food[k] || 0) * s;
    return acc;
  }, Object.fromEntries(NUTRIENT_KEYS.map(k => [k, 0])));

  // Grams in one of a serving definition, given the current mode.
  function gramsForItem(item, mode = servingMode) {
    if (mode === 'weight') return Number(item.value) || 0;
    return totalWeight / (Number(item.value) || 1); // servings-per-recipe
  }

  function updateServing(i, field, val) {
    setServings(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addServing() { setServings(prev => [...prev, { name: '', value: servingMode === 'weight' ? String(Math.round(totalWeight)) : '1' }]); }
  function removeServing(i) { setServings(prev => prev.filter((_, idx) => idx !== i)); }

  // Switch mode while preserving the real gram size of each serving.
  function switchMode(m) {
    if (m === servingMode) return;
    setServings(prev => prev.map(s => {
      const grams = gramsForItem(s);
      const v = m === 'weight' ? round1(grams) : round1(totalWeight / (grams || 1));
      return { ...s, value: String(v) };
    }));
    setServingMode(m);
  }

  const primaryGrams = gramsForItem(servings[0] || { value: '1' });
  // Per-100 g density. 3 decimals (not 1) so trace-scale values (EPA/DHA, amino
  // acids in grams) survive rounding.
  const dens = k => (totalWeight > 0 ? +((totals[k] || 0) / totalWeight * 100).toFixed(3) : 0);

  const g = goals || {};
  const goalVal = { energy: g.kcal || 2000, protein: g.proteinG || 150, carbs: g.carbsG || 225, fat: g.fatG || 65 };

  const summaryGrams = gramsForItem(servings[summaryIdx] || servings[0] || { value: '1' });
  const sFrac = totalWeight > 0 ? summaryGrams / totalWeight : 0;
  const sv = {
    kcal: totals.kcal * sFrac, proteinG: totals.proteinG * sFrac, carbsG: totals.carbsG * sFrac,
    fatG: totals.fatG * sFrac, fiberG: totals.fiberG * sFrac,
  };
  const netCarbs = Math.max(0, sv.carbsG - sv.fiberG);

  const canNext = !!name.trim() && ingredients.length > 0;
  const stepIdx = STEPS.indexOf(step);

  function buildFood() {
    return {
      ...(meal || {}),
      name: name.trim(), brand: 'Recipe', category: 'other', sourceDb: 'custom', isCustom: true,
      // Full per-100 g nutrient profile (macros + every micro) from the ingredients.
      ...Object.fromEntries(NUTRIENT_KEYS.map(k => [k, dens(k)])),
      servingSizeG: round1(primaryGrams) || 100,
      servingUnit: (servings[0]?.name || '').trim() || 'serving',
      servingSizes: servings.map(s => ({ name: (s.name || '').trim() || 'serving', grams: round1(gramsForItem(s)) || 0 })),
      recipe: {
        mode: servingMode, advanced,
        servings: servings.map(s => ({ name: (s.name || '').trim() || 'serving', value: Number(s.value) || (servingMode === 'weight' ? 0 : 1) })),
        totalWeight: round1(totalWeight), category, notes,
      },
      ingredients: ingredients.map(({ food, amountG }) => ({
        amountG,
        // Snapshot every nutrient so re-editing the meal later recomputes with full micros.
        food: {
          id: food.id, name: food.name, category: food.category,
          ...Object.fromEntries(NUTRIENT_KEYS.map(k => [k, food[k] || 0])),
        },
      })),
    };
  }

  async function handleSave(addToDiary) {
    if (!canNext) return;
    setSaving(true);
    const food = buildFood();
    const id = await saveFood(food);
    const saved = { ...food, id: food.id ?? id };
    if (addToDiary) {
      const oneG = round1(primaryGrams) || 100;
      const entry = {
        foodId: saved.id, amountG: oneG, unitLabel: `1 ${saved.servingUnit}`,
        // Serving context so a later edit restores "1 <serving>" (same as ServingEditorModal).
        unit: saved.servingUnit, amount: 1,
        foodServingSizeG: saved.servingSizeG || 100,
        foodServingUnit: saved.servingUnit || null,
        foodServingSizes: saved.servingSizes || null,
        foodName: saved.name, foodCategory: 'other',
        // Per-100 g snapshot of every nutrient the recipe carries.
        ...foodToEntryFields(saved),
      };
      if (onLog) {
        // The diary owns the write (it adds date/mealId and refreshes its view).
        await onLog(entry);
      } else {
        const hr = new Date().getHours();
        const idx = hr < 11 ? 0 : hr < 15 ? 1 : hr < 21 ? 2 : 3;
        const mealId = meals[Math.min(idx, Math.max(0, meals.length - 1))]?.id ?? 1;
        await addDiaryEntry({ ...entry, mealId, date: new Date().toISOString().slice(0, 10) });
      }
    }
    setSaving(false);
    onSaved(saved, { logged: addToDiary });
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Delete "${meal.name}"?`)) return;
    await deleteFood(meal.id);
    onSaved(null);
  }

  const iconBtn = { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nc-text2)', background: 'none', border: 'none', cursor: 'pointer' };
  const addBtn = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 10, background: 'var(--nc-surf2)', border: '1px solid var(--nc-border)', color: 'var(--nc-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const pill = (enabled = true) => ({ padding: '12px 30px', borderRadius: 24, border: 'none', background: 'var(--nc-accent)', color: '#06281a', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: enabled ? 1 : 0.5 });
  const title = step === 'ingredients' ? (isEdit ? 'Edit Meal' : 'Create Meal')
    : step === 'serving' ? 'Serving Sizes' : step === 'details' ? 'Details' : 'Summary';

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-picker" ref={panelRef}>
        <div className="nc-sheet-grip" {...handleProps} />
        <div className="nc-picker-header" {...zoneProps}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button style={iconBtn} onClick={stepIdx === 0 ? onClose : () => setStep(STEPS[stepIdx - 1])}>
              {stepIdx === 0 ? <X size={20} /> : <ChevronLeft size={22} />}
            </button>
            <span className="nc-picker-title">{title}</span>
            <div style={{ width: 34 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', paddingBottom: 4 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ width: i === stepIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === stepIdx ? 'var(--nc-accent)' : 'var(--nc-surf2)', transition: 'width .15s' }} />
            ))}
          </div>
        </div>

        {/* ───────── Step 1: Ingredients ───────── */}
        {step === 'ingredients' && (
          <>
            <div className="nc-picker-list" style={{ padding: '14px 16px 0' }}>
              <input className="nc-amount-input" style={{ width: '100%', fontSize: 16, padding: '11px 14px', textAlign: 'left', marginBottom: 18 }}
                placeholder="Meal name (required)" value={name} onChange={e => setName(e.target.value)} />

              <div className="nc-section-title">Ingredients</div>
              <div style={{ border: '1px solid var(--nc-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--nc-surf)' }}>
                <div style={{ display: 'flex', gap: 8, padding: 12 }}>
                  <button style={addBtn} onClick={() => setShowPicker(true)}><Plus size={16} /> Add Food</button>
                  <button style={addBtn} onClick={() => setShowScan(true)}><Camera size={16} /> Scan Food</button>
                </div>

                {ingredients.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--nc-border)' }}>
                    {ingredients.map(({ food, amountG }) => (
                      <div key={food.id} className="nc-food-row" style={{ alignItems: 'center' }}>
                        <div className={`nc-food-icon cat-${food.category}`}>{CATEGORY_EMOJI[food.category] || '🍽️'}</div>
                        <div className="nc-food-body">
                          <div className="nc-food-name">{food.name}</div>
                          <div className="nc-food-brand">{Math.round((food.kcal || 0) * amountG / 100)} kcal</div>
                        </div>
                        <input type="number" min="1" step="1" className="nc-amount-input" style={{ width: 60, padding: '4px 6px', fontSize: 16 }}
                          value={amountG} onChange={e => updateAmount(food.id, e.target.value)} />
                        <span style={{ fontSize: 11, color: 'var(--nc-text3)', marginLeft: 3 }}>g</span>
                        <button style={{ marginLeft: 8, color: 'var(--nc-text3)', flexShrink: 0 }} onClick={() => removeIngredient(food.id)}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--nc-border)', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--nc-text2)' }}>Total weight</span>
                  <span style={{ fontWeight: 700, color: 'var(--nc-text)' }}>{Math.round(totalWeight)} g</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--nc-border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <button disabled={!canNext} onClick={() => setStep('serving')} style={pill(canNext)}>Next</button>
            </div>
          </>
        )}

        {/* ───────── Step 2: Serving Sizes ───────── */}
        {step === 'serving' && (
          <>
            <div className="nc-picker-list" style={{ padding: '14px 16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--nc-text2)', marginBottom: 14 }}>
                {servingMode === 'servings'
                  ? 'How many servings does this meal make? Turn on Advanced to add more named serving sizes.'
                  : 'How much does one serving of this meal weigh? Turn on Advanced to add more named serving sizes.'}
              </div>

              <div className="nc-field-row" style={{ borderBottom: 'none', marginBottom: 8 }}>
                <span className="nc-field-label">Advanced serving sizes</span>
                <button onClick={() => setAdvanced(a => !a)}
                  style={{ width: 46, height: 27, borderRadius: 14, border: 'none', cursor: 'pointer', background: advanced ? 'var(--nc-accent)' : 'var(--nc-surf2)', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: advanced ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
              </div>

              <div style={{ display: 'flex', background: 'var(--nc-surf2)', borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
                {[['servings', 'Servings based'], ['weight', 'Weight based']].map(([v, l]) => (
                  <button key={v} onClick={() => switchMode(v)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: servingMode === v ? 'var(--nc-accent)' : 'transparent', color: servingMode === v ? '#06281a' : 'var(--nc-text2)' }}>{l}</button>
                ))}
              </div>

              <div className="nc-card">
                <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 6 }}>
                  <span style={{ flex: 1 }}>Serving name</span>
                  <span style={{ width: 120, textAlign: 'right' }}>{servingMode === 'weight' ? 'Grams / serving' : 'Servings / recipe'}</span>
                  {advanced && <span style={{ width: 28 }} />}
                </div>
                {(advanced ? servings : servings.slice(0, 1)).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--nc-border)' }}>
                    <input className="nc-amount-input" style={{ flex: 1, fontSize: 16, padding: '8px 10px', textAlign: 'left' }}
                      placeholder={i === 0 ? 'serving' : 'e.g. bowl'} value={s.name} onChange={e => updateServing(i, 'name', e.target.value)} />
                    <input className="nc-amount-input" type="number" min="0" step="0.1" inputMode="decimal" style={{ width: 90, fontSize: 16, padding: '8px 10px' }}
                      value={s.value} onChange={e => updateServing(i, 'value', e.target.value)} />
                    {advanced && (
                      <button style={{ width: 28, color: 'var(--nc-text3)', flexShrink: 0, opacity: i === 0 ? 0.3 : 1 }} disabled={i === 0} onClick={() => removeServing(i)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {advanced && (
                  <button onClick={addServing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: 10, background: 'none', border: 'none', color: 'var(--nc-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={15} /> Add serving size
                  </button>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--nc-text3)', padding: '8px 2px 0' }}>
                1 {(servings[0]?.name || 'serving').trim() || 'serving'} ≈ {Math.round(primaryGrams)} g · meal total {Math.round(totalWeight)} g
              </div>
            </div>
            <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--nc-border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('details')} style={pill(true)}>Next</button>
            </div>
          </>
        )}

        {/* ───────── Step 3: Details ───────── */}
        {step === 'details' && (
          <>
            <div className="nc-picker-list" style={{ padding: '14px 16px 0' }}>
              <div className="nc-section-title">Category</div>
              <div className="nc-card">
                <div className="nc-field-row" style={{ borderBottom: 'none' }}>
                  <span className="nc-field-label">Meal category</span>
                  <select className="nc-field-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {MEAL_CATEGORIES.map(c => <option key={c} value={c}>{c || 'None'}</option>)}
                  </select>
                </div>
              </div>

              <div className="nc-section-title">Notes</div>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Recipe instructions, source, reminders…"
                style={{ width: '100%', minHeight: 140, resize: 'vertical', fontSize: 16, padding: 12, borderRadius: 12, background: 'var(--nc-surf)', border: '1px solid var(--nc-border)', color: 'var(--nc-text)', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--nc-border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSummaryIdx(0); setStep('summary'); }} style={pill(true)}>Next</button>
            </div>
          </>
        )}

        {/* ───────── Step 4: Summary ───────── */}
        {step === 'summary' && (
          <>
            <div className="nc-picker-list" style={{ padding: '14px 16px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--nc-text)', marginBottom: 14 }}>{name}</div>

              <div className="nc-card" style={{ marginBottom: 16 }}>
                <div className="nc-field-row" style={{ borderBottom: 'none' }}>
                  <span className="nc-field-label">Serving size</span>
                  <select className="nc-field-select" value={summaryIdx} onChange={e => setSummaryIdx(Number(e.target.value))}>
                    {servings.map((s, i) => (
                      <option key={i} value={i}>{(s.name || 'serving').trim() || 'serving'} — {Math.round(gramsForItem(s))} g</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', marginBottom: 10 }}>Energy Summary</div>
              <Donut kcal={sv.kcal} p={sv.proteinG} c={netCarbs} f={sv.fatG} />

              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', margin: '16px 0 4px' }}>Macronutrient Targets</div>
              <TargetRow label="Energy"    value={sv.kcal}     target={goalVal.energy}  unit="kcal" />
              <TargetRow label="Protein"   value={sv.proteinG} target={goalVal.protein} unit="g" />
              <TargetRow label="Net Carbs" value={netCarbs}    target={goalVal.carbs}   unit="g" />
              <TargetRow label="Fat"       value={sv.fatG}     target={goalVal.fat}     unit="g" />

              {isEdit && (
                <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 18, padding: 12, background: 'none', border: 'none', color: 'var(--nc-warn)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <Trash2 size={15} /> Delete Meal
                </button>
              )}
            </div>
            <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--nc-border)', flexShrink: 0, display: 'flex', gap: 10 }}>
              <button disabled={saving} onClick={() => handleSave(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 24, border: '1px solid var(--nc-border)', background: 'var(--nc-surf2)', color: 'var(--nc-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Save Meal'}
              </button>
              <button disabled={saving} onClick={() => handleSave(true)} style={{ ...pill(!saving), flex: 1.5, padding: '12px 14px', fontSize: 14 }}>
                Save &amp; Add to Diary
              </button>
            </div>
          </>
        )}
      </div>

      {showScan && (
        <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowScan(false); }}>
          <div className="nc-picker">
            <div className="nc-sheet-grip" />
            <div className="nc-picker-header">
              <div className="nc-picker-title-row">
                <span className="nc-picker-title">Scan Food</span>
                <button className="nc-picker-close" onClick={() => setShowScan(false)}>✕</button>
              </div>
            </div>
            <div className="nc-picker-list">
              <BarcodeScanner onFound={handleScanFound} onNotFound={() => setShowScan(false)} />
            </div>
          </div>
        </div>
      )}

      {showPicker && (
        <FoodSearchModal
          onPick={food => { setShowPicker(false); setDetailFood(food); }}
          onScan={() => { setShowPicker(false); setShowScan(true); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {detailFood && (
        <IngredientDetailModal
          food={detailFood}
          goals={goals}
          ctaLabel="Add to Meal"
          onAdd={async ({ amountG }) => {
            // Scanned OFF results arrive unsaved; ingredients are keyed by food.id,
            // so persist here — only once the user commits it to the meal.
            let food = detailFood;
            if (food.id == null) food = { ...food, id: await saveFood(food) };
            addIngredientGrams(food, Math.round(amountG));
            setDetailFood(null);
          }}
          onBack={() => setDetailFood(null)}
        />
      )}
    </div>
  );
}
