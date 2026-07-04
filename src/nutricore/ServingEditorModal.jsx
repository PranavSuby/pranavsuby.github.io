import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { computePreview, toGramsForFood, getServings, servingUnitOptions, unitLabel, foodToEntryFields } from './nutrition';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';
import NutritionFactsSheet from './NutritionFactsSheet';

const CATEGORY_EMOJI = {
  protein: '🥩', dairy: '🥛', grain: '🌾', vegetable: '🥦',
  fruit: '🍎', fat: '🫒', beverage: '☕', supplement: '💊', other: '🟤',
};

export default function ServingEditorModal({
  food, meals, onLog, onBack,
  defaultMealId, initialAmount, initialUnit, ctaLabel = 'Log to Diary',
}) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onBack);
  useBackClose(onBack);
  // Custom foods and meals can name their serving(s) (e.g. "taco", "bowl"). Default to
  // the food's first named serving so logging uses that name + its real gram weight.
  const servings    = getServings(food);
  const unitOptions = servingUnitOptions(food);
  const defaultUnit = servings[0]?.name || 'serving';

  const [amount, setAmount]   = useState(initialAmount ?? 1);
  const [unit, setUnit]       = useState(initialUnit ?? defaultUnit);
  const [mealId, setMealId]   = useState(defaultMealId ?? meals[0]?.id ?? 1);
  const [showFacts, setShowFacts] = useState(false);

  // Key the reset on the food's id, not the object: parents construct the `food`
  // prop inline, so its identity changes on every parent re-render (e.g. a toast
  // clearing) — resetting on identity would wipe the user's in-progress input.
  useEffect(() => {
    setUnit(initialUnit ?? defaultUnit);
    setAmount(initialAmount ?? 1);
    // eslint-disable-next-line
  }, [food?.id, initialUnit, initialAmount]);

  const isRecipe    = food.brand === 'Recipe';
  const servingName = defaultUnit;

  const amountG  = toGramsForFood(food, Number(amount) || 0, unit);
  const preview  = computePreview(food, amountG);
  const label    = unitLabel(Number(amount) || 0, unit);
  const canLog   = amountG > 0;

  function handleLog() {
    if (!canLog) return;
    onLog({
      foodId:           food.id,
      mealId:           Number(mealId),
      amountG,
      unitLabel:        label,
      // Serving context so a later edit can restore the chosen unit ("1 cup" stays
      // "1 cup"). Old entries lack these and fall back to editing in grams.
      unit,
      amount:           Number(amount) || 0,
      foodServingSizeG: food.servingSizeG || 100,
      foodServingUnit:  food.servingUnit  || null,
      foodServingSizes: food.servingSizes || null,
      foodName:         food.name,
      foodCategory:     food.category,
      // Per-100 g snapshot of every nutrient the food carries (foodKcal, foodProteinG, …)
      ...foodToEntryFields(food),
    });
  }

  const emoji = CATEGORY_EMOJI[food.category] || '🍽️';

  return (
    <div className="nc-serving" ref={panelRef} {...zoneProps}>
      <div className="nc-sheet-grip" {...handleProps} />
      <div className="nc-serving-header">
        <div className={`nc-serving-icon cat-${food.category}`}>{emoji}</div>
        <div>
          <div className="nc-serving-food-name">{food.name}</div>
          {food.brand && <div className="nc-serving-food-brand">{food.brand}</div>}
          <div className="nc-serving-food-brand" style={{ color: 'var(--nc-text3)', marginTop: 2 }}>
            {isRecipe ? `${Math.round(food.kcal)} kcal / ${servingName}` : `${food.kcal} kcal / 100 g`}
          </div>
        </div>
      </div>

      <div className="nc-serving-body">
        <div>
          <div className="nc-serving-label">Amount</div>
          <div className="nc-amount-row">
            <input
              className="nc-amount-input"
              type="number"
              min="0"
              step="0.5"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputMode="decimal"
            />
            <select
              className="nc-unit-select"
              value={unit}
              onChange={e => setUnit(e.target.value)}
            >
              {/* Legacy entries may be stored in a unit no longer offered (e.g. "cup");
                  keep it selectable so editing them doesn't blank the picker. */}
              {(unitOptions.includes(unit) ? unitOptions : [...unitOptions, unit]).map(u => {
                const sv = servings.find(s => s.name === u);
                return (
                  <option key={u} value={u}>
                    {sv ? (isRecipe ? sv.name : `${sv.name} (${Math.round(sv.grams)}g)`) : u}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div>
          <div className="nc-serving-label">Meal</div>
          <select
            className="nc-meal-select"
            value={mealId}
            onChange={e => setMealId(e.target.value)}
          >
            {meals.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="nc-serving-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nutrition for {label}</span>
            <span
              onClick={() => setShowFacts(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--nc-accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Full facts <ChevronRight size={13} />
            </span>
          </div>
          <div className="nc-preview-grid" onClick={() => setShowFacts(true)} style={{ cursor: 'pointer' }}>
            <div className="nc-preview-card">
              <div className="nc-preview-val">{preview.kcal}</div>
              <div className="nc-preview-lbl">kcal</div>
            </div>
            <div className="nc-preview-card">
              <div className="nc-preview-val">{preview.proteinG}g</div>
              <div className="nc-preview-lbl">protein</div>
            </div>
            <div className="nc-preview-card">
              <div className="nc-preview-val">{preview.carbsG}g</div>
              <div className="nc-preview-lbl">carbs</div>
            </div>
            <div className="nc-preview-card">
              <div className="nc-preview-val">{preview.fatG}g</div>
              <div className="nc-preview-lbl">fat</div>
            </div>
          </div>
        </div>
      </div>

      {showFacts && (
        <NutritionFactsSheet food={food} amountG={amountG} label={label} onClose={() => setShowFacts(false)} />
      )}

      <div className="nc-serving-footer">
        <button className="nc-log-btn" onClick={handleLog} disabled={!canLog}>
          {ctaLabel}
        </button>
        <button
          style={{ width: '100%', marginTop: 10, padding: '10px', color: 'var(--nc-text2)', fontSize: 14 }}
          onClick={onBack}
        >
          {initialAmount != null ? 'Cancel' : '← Back to Search'}
        </button>
      </div>
    </div>
  );
}
