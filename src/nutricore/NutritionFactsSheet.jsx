import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';

// Full "nutrition facts" panel for a food, scaled to the chosen serving (amountG grams).
// Swipe-down / backdrop-tap to dismiss, like the other NutriCore sheets.

const MACROS = [
  ['Calories',       'kcal',     'kcal', 0, false],
  ['Total Fat',      'fatG',     'g',    1, false],
  ['Saturated Fat',  'satFatG',  'g',    1, true],
  ['Trans Fat',      'transFatG','g',    1, true],
  ['Omega-3',        'omega3G',  'g',    2, true],
  ['Omega-6',        'omega6G',  'g',    2, true],
  ['Sodium',         'sodiumMg', 'mg',   0, false],
  ['Total Carbs',    'carbsG',   'g',    1, false],
  ['Fiber',          'fiberG',   'g',    1, true],
  ['Total Sugars',   'sugarG',   'g',    1, true],
  ['Added Sugars',   'addedSugarG','g',  1, true],
  ['Protein',        'proteinG', 'g',    1, false],
];

const MICROS = [
  ['Vitamin A',  'vitaminAMcg', 'mcg', 0],
  ['Vitamin C',  'vitaminCMg',  'mg',  1],
  ['Vitamin D',  'vitaminDMcg', 'mcg', 1],
  ['Vitamin E',  'vitaminEMg',  'mg',  1],
  ['Vitamin K',  'vitaminKMcg', 'mcg', 1],
  ['Thiamine (B1)',   'thiamineMg',   'mg',  2],
  ['Riboflavin (B2)', 'riboflavinMg', 'mg',  2],
  ['Niacin (B3)',     'niacinMg',     'mg',  1],
  ['Vitamin B6',      'b6Mg',         'mg',  2],
  ['Folate (B9)',     'folateMcg',    'mcg', 0],
  ['Vitamin B12',     'b12Mcg',       'mcg', 1],
  ['Calcium',    'calciumMg',   'mg',  0],
  ['Iron',       'ironMg',      'mg',  1],
  ['Magnesium',  'magnesiumMg', 'mg',  0],
  ['Potassium',  'potassiumMg', 'mg',  0],
  ['Zinc',       'zincMg',      'mg',  1],
  ['Copper',     'copperMg',    'mg',  2],
  ['Selenium',   'seleniumMcg', 'mcg', 0],
];

function Row({ label, value, unit, sub }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '9px 0', borderBottom: '1px solid var(--nc-border)',
      paddingLeft: sub ? 16 : 0,
    }}>
      <span style={{ fontSize: sub ? 14 : 15, color: sub ? 'var(--nc-text2)' : 'var(--nc-text)', fontWeight: sub ? 400 : 600 }}>
        {label}
      </span>
      <span style={{ fontSize: sub ? 14 : 15, color: 'var(--nc-text)', fontWeight: sub ? 400 : 600 }}>
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

export default function NutritionFactsSheet({ food, amountG, label, onClose }) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose);
  const s = (amountG || 0) / 100;
  const scaled = (key, dec) => {
    const v = (food[key] || 0) * s;
    return dec ? +v.toFixed(dec) : Math.round(v);
  };
  const has = key => (food[key] || 0) > 0;
  const microsPresent = MICROS.filter(([, key]) => has(key));

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-serving" ref={panelRef} style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="nc-sheet-grip" {...handleProps} />
        <div style={{ padding: '0 18px 12px', flexShrink: 0 }} {...zoneProps}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--nc-text)' }}>Nutrition Facts</div>
          <div style={{ fontSize: 13, color: 'var(--nc-text3)', marginTop: 2 }}>
            {food.name}{label ? ` · ${label}` : ''}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 18px 18px', flex: 1 }}>
          {MACROS.map(([lbl, key, unit, dec, sub]) =>
            (!sub || has(key)) ? (
              <Row key={key} label={lbl} value={scaled(key, dec)} unit={unit} sub={sub} />
            ) : null
          )}
          {microsPresent.length > 0 ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 0 4px' }}>
                Vitamins &amp; Minerals
              </div>
              {microsPresent.map(([lbl, key, unit, dec]) => (
                <Row key={key} label={lbl} value={scaled(key, dec)} unit={unit} />
              ))}
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--nc-text3)', padding: '14px 0 0' }}>
              No vitamin &amp; mineral data for this food.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
