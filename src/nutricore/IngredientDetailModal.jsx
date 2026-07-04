import { useState } from 'react';
import { ChevronLeft, BarChart3 } from 'lucide-react';
import { toGramsForFood, getServings, servingUnitOptions, unitLabel } from './nutrition';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';

// Rich, MacroFactor-style nutrient breakdown shown when picking an ingredient (or any
// food). Amount + serving size at the top scale every value live; the body mirrors
// MacroFactor's Energy Summary → Targets → Complete Nutrient Summary → Nutrient Balance.
//
// Many of these fields aren't carried by our food DB; those rows render "No Data",
// exactly like MacroFactor does for foods missing that data.

const ENERGY_TARGET = 2000;

// [label, foodKey, unit, decimals, target, indent]
// target: a number (RDA/DV), a goal token ('energy'|'protein'|'carbs'|'fat'), or null (no target)
const GENERAL = [
  ['Energy (Consumed)', 'kcal',      'kcal', 0, 'energy', 0],
  ['Alcohol',           'alcoholG',  'g',    1, null,     0],
  ['Caffeine',          'caffeineMg','mg',   0, null,     0],
  ['Oxalate',           'oxalateMg', 'mg',   0, null,     0],
  ['Phytate',           'phytateMg', 'mg',   0, null,     0],
  ['Water',             'waterG',    'g',    0, 3700,     0],
];
const VITAMINS = [
  ['B1 (Thiamine)',          'thiamineMg',   'mg',  2, 1.2, 0],
  ['B2 (Riboflavin)',        'riboflavinMg', 'mg',  2, 1.3, 0],
  ['B3 (Niacin)',            'niacinMg',     'mg',  1, 16,  0],
  ['B5 (Pantothenic Acid)',  'b5Mg',         'mg',  1, 5,   0],
  ['B6 (Pyridoxine)',        'b6Mg',         'mg',  2, 1.7, 0],
  ['B7 (Biotin)',            'biotinMcg',    'mcg', 0, 30,  0],
  ['B9 (Folate)',            'folateMcg',    'mcg', 0, 400, 0],
  ['B12 (Cobalamin)',        'b12Mcg',       'mcg', 1, 2.4, 0],
  ['Vitamin A',              'vitaminAMcg',  'mcg', 1, 900, 0],
  ['Vitamin C',              'vitaminCMg',   'mg',  1, 90,  0],
  ['Vitamin D',              'vitaminDMcg',  'mcg', 1, 15,  0],
  ['Vitamin E',              'vitaminEMg',   'mg',  1, 15,  0],
  ['Vitamin K',              'vitaminKMcg',  'mcg', 1, 120, 0],
];
const MINERALS = [
  ['Calcium',    'calciumMg',   'mg',  0, 1000, 0],
  ['Copper',     'copperMg',    'mg',  1, 0.9,  0],
  ['Iron',       'ironMg',      'mg',  1, 8,    0],
  ['Magnesium',  'magnesiumMg', 'mg',  0, 400,  0],
  ['Manganese',  'manganeseMg', 'mg',  1, 2.3,  0],
  ['Phosphorus', 'phosphorusMg','mg',  0, 700,  0],
  ['Potassium',  'potassiumMg', 'mg',  0, 3400, 0],
  ['Selenium',   'seleniumMcg', 'mcg', 1, 55,   0],
  ['Sodium',     'sodiumMg',    'mg',  0, 2300, 0],
  ['Zinc',       'zincMg',      'mg',  1, 11,   0],
];
const CARBS = [
  ['Carbs (Total)',    'carbsG',          'g', 1, 'carbs', 0],
  ['Fiber',            'fiberG',          'g', 1, 38,      1],
  ['Fiber (Insoluble)','fiberInsolubleG', 'g', 1, null,    2],
  ['Fiber (Soluble)',  'fiberSolubleG',   'g', 1, null,    2],
  ['Carbs (Net)',      '__netCarbs',      'g', 1, 'carbs', 1],
  ['Starch',           'starchG',         'g', 1, null,    1],
  ['Sugars',           'sugarG',          'g', 1, null,    1],
  ['Added Sugars',     'addedSugarG',     'g', 1, null,    2],
];
const LIPIDS = [
  ['Fat (Total)',            'fatG',       'g',  1, 'fat', 0],
  ['Fat (Monounsaturated)',  'monoFatG',   'g',  1, null,  1],
  ['Fat (Polyunsaturated)',  'polyFatG',   'g',  1, null,  1],
  ['Omega-3',                'omega3G',    'g',  2, 1.6,   1],
  ['Omega-3 (ALA)',          'omega3AlaG', 'g',  2, null,  2],
  ['Omega-3 (DHA)',          'omega3DhaG', 'g',  2, null,  2],
  ['Omega-3 (EPA)',          'omega3EpaG', 'g',  2, null,  2],
  ['Omega-6',                'omega6G',    'g',  2, 17,    1],
  ['Omega-6 (AA)',           'omega6AaG',  'g',  2, null,  2],
  ['Omega-6 (LA)',           'omega6LaG',  'g',  2, null,  2],
  ['Fat (Saturated)',        'satFatG',    'g',  1, null,  1],
  ['Fat (Trans)',            'transFatG',  'g',  1, null,  1],
  ['Cholesterol',            'cholesterolMg','mg',0, null, 0],
];
const PROTEIN = [
  ['Protein',       'proteinG',      'g', 1, 'protein', 0],
  ['Cystine',       'cystineG',      'g', 2, null, 1],
  ['Histidine',     'histidineG',    'g', 2, null, 1],
  ['Isoleucine',    'isoleucineG',   'g', 2, null, 1],
  ['Leucine',       'leucineG',      'g', 2, null, 1],
  ['Lysine',        'lysineG',       'g', 2, null, 1],
  ['Methionine',    'methionineG',   'g', 2, null, 1],
  ['Phenylalanine', 'phenylalanineG','g', 2, null, 1],
  ['Threonine',     'threonineG',    'g', 2, null, 1],
  ['Tryptophan',    'tryptophanG',   'g', 2, null, 1],
  ['Tyrosine',      'tyrosineG',     'g', 2, null, 1],
  ['Valine',        'valineG',       'g', 2, null, 1],
];

// Ratio gauges. [label, numKey, denKey, max, idealLow, idealHigh]
const BALANCES = [
  ['Omega-6 : Omega-3',   'omega6G',    'omega3G',   25, 1,    4],
  ['Zinc : Copper',       'zincMg',     'copperMg',  20, 8,    12],
  ['Potassium : Sodium',  'potassiumMg','sodiumMg',  12, 2,    12],
  ['Calcium : Magnesium', 'calciumMg',  'magnesiumMg', 6, 2,   3],
  ['Calcium : Oxalate',   'calciumMg',  'oxalateMg', 2,  1,    2],
];

function ChevSection({ title, children, open, onToggle }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)' }}>{title}</span>
        <ChevronLeft size={18} style={{ color: 'var(--nc-text3)', transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }} />
      </button>
      {open && children}
    </div>
  );
}

function NutrientRow({ label, value, unit, target, dec, indent }) {
  const noData = value == null;
  const pct = (!noData && typeof target === 'number' && target > 0) ? Math.round((value / target) * 100) : null;
  const valTxt = noData ? null : value.toFixed(dec).replace(/\.0+$/, m => (dec ? m : ''));
  const targetTxt = typeof target === 'number' ? `${target} ${unit}` : null;

  let detail;
  if (noData) detail = 'No Data';
  else if (targetTxt) detail = `${valTxt} / ${targetTxt}`;
  else detail = `${valTxt} ${unit} / (No Target)`;

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--nc-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingLeft: indent * 14 }}>
        <span style={{ fontSize: 13.5, color: noData ? 'var(--nc-text3)' : 'var(--nc-text2)' }}>
          <span style={{ fontWeight: 600, color: noData ? 'var(--nc-text3)' : 'var(--nc-text)' }}>{label}</span>
          {' '}- {detail}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: pct == null ? 'var(--nc-text3)' : 'var(--nc-text2)', flexShrink: 0 }}>
          {pct == null ? '0%' : `${pct}%`}
        </span>
      </div>
      {pct != null && (
        <div style={{ height: 4, borderRadius: 3, background: 'var(--nc-surf2)', marginTop: 5 }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, pct)}%`, background: 'var(--nc-accent)' }} />
        </div>
      )}
    </div>
  );
}

// Semicircular ratio gauge with a needle.
function Gauge({ label, value, max, idealLow, idealHigh }) {
  const cx = 50, cy = 48, r = 38;
  const polar = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (a0, a1) => {
    const [x0, y0] = polar(a0); const [x1, y1] = polar(a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const ang = (t) => 180 - Math.max(0, Math.min(1, t)) * 180;
  const t = max > 0 ? value / max : 0;
  const [nx, ny] = polar(ang(t));
  const ix = cx + (nx - cx) * 0.18, iy = cy + (ny - cy) * 0.18;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 132 }}>
      <svg viewBox="0 0 100 56" style={{ width: 120 }}>
        <path d={arc(180, 0)} fill="none" stroke="var(--nc-surf2)" strokeWidth="7" strokeLinecap="round" />
        <path d={arc(ang(idealLow / max), ang(idealHigh / max))} fill="none" stroke="var(--nc-accent)" strokeWidth="7" strokeLinecap="round" />
        <line x1={ix} y1={iy} x2={nx} y2={ny} stroke="var(--nc-text)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="var(--nc-text)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 116, fontSize: 10, color: 'var(--nc-text3)', marginTop: -4 }}>
        <span>0</span><span style={{ color: 'var(--nc-text)', fontWeight: 700 }}>{value ? value.toFixed(value < 10 ? 1 : 0) : '0.000'}</span><span>{max}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--nc-text2)', marginTop: 2, textAlign: 'center' }}>{label}</div>
    </div>
  );
}

export default function IngredientDetailModal({
  food, goals, onAdd, onBack, ctaLabel = 'Add to Recipe',
  initialAmount, initialUnit,
}) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onBack);
  useBackClose(onBack);
  const servings    = getServings(food);
  const unitOptions = servingUnitOptions(food);
  const isNamed     = !!food.servingUnit || !!food.servingSizes;
  const [amount, setAmount] = useState(initialAmount ?? (isNamed ? 1 : 100));
  const [unit,   setUnit]   = useState(initialUnit ?? (isNamed ? servings[0].name : 'g'));
  const [openSummary, setOpenSummary] = useState(false);
  const [openBalance, setOpenBalance] = useState(false);

  const g = goals || {};
  const goalVal = { energy: g.kcal || ENERGY_TARGET, protein: g.proteinG || 150, carbs: g.carbsG || 225, fat: g.fatG || 65 };

  const servingName = servings[0].name;
  const amountG = toGramsForFood(food, Number(amount) || 0, unit);
  const s = amountG / 100;
  const canAdd = amountG > 0;

  const raw = key => {
    if (key === '__netCarbs') {
      if (food.carbsG == null) return null;
      return Math.max(0, (food.carbsG || 0) - (food.fiberG || 0));
    }
    const v = food[key];
    return v == null ? null : v;
  };
  const scaled = key => {
    const v = raw(key);
    return v == null ? null : v * s;
  };
  const targetOf = t => (typeof t === 'string' ? goalVal[t] : t);

  // Energy summary split
  const kcal = (scaled('kcal') || 0);
  const pK = (scaled('proteinG') || 0) * 4;
  const cK = Math.max(0, (raw('__netCarbs') || 0) * s) * 4;
  const fK = (scaled('fatG') || 0) * 9;
  const sum = pK + cK + fK || 1;
  const pPct = Math.round((pK / sum) * 100);
  const cPct = Math.round((cK / sum) * 100);
  const fPct = Math.max(0, 100 - pPct - cPct);
  const donut = `conic-gradient(#34d399 0 ${pPct}%, #38bdf8 ${pPct}% ${pPct + cPct}%, #fb923c ${pPct + cPct}% 100%)`;

  const targets = [
    ['Energy',    kcal,                            goalVal.energy,  'kcal', 0],
    ['Protein',   (scaled('proteinG') || 0),       goalVal.protein, 'g',    1],
    ['Net Carbs', (raw('__netCarbs') || 0) * s,    goalVal.carbs,   'g',    1],
    ['Fat',       (scaled('fatG') || 0),           goalVal.fat,     'g',    1],
  ];
  const highlighted = [
    ['Fiber', 'fiberG', 38], ['Vitamin C', 'vitaminCMg', 90],
    ['Iron', 'ironMg', 8], ['B12 (Cobalamin)', 'b12Mcg', 2.4],
    ['Calcium', 'calciumMg', 1000], ['Folate', 'folateMcg', 400],
    ['Vitamin A', 'vitaminAMcg', 900], ['Potassium', 'potassiumMg', 3400],
  ];

  const listedCount = [...GENERAL, ...VITAMINS, ...MINERALS, ...CARBS, ...LIPIDS, ...PROTEIN]
    .filter(([, key]) => raw(key) != null).length;

  function renderSection(title, rows) {
    return (
      <>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nc-text2)', margin: '12px 0 2px' }}>{title}</div>
        {rows.map(([label, key, unit2, dec, target, indent]) => (
          <NutrientRow key={key} label={label} value={scaled(key)} unit={unit2} dec={dec}
            target={targetOf(target)} indent={indent} />
        ))}
      </>
    );
  }

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onBack(); }}>
      <div className="nc-serving" ref={panelRef} style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="nc-sheet-grip" {...handleProps} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 10px', flexShrink: 0 }} {...zoneProps}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--nc-text2)', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
            {food.brand && <div style={{ fontSize: 12, color: 'var(--nc-text3)' }}>{food.brand}</div>}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 16px 16px', flex: 1 }}>
          {/* Amount + serving size */}
          <div className="nc-card" style={{ marginBottom: 14 }}>
            <div className="nc-field-row">
              <span className="nc-field-label">Amount</span>
              <input className="nc-field-input" type="number" min="0" step="0.5" inputMode="decimal"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="nc-field-row" style={{ borderBottom: 'none' }}>
              <span className="nc-field-label">Serving Size</span>
              <select className="nc-field-select" value={unit} onChange={e => setUnit(e.target.value)}>
                {unitOptions.map(u => {
                  const sv = servings.find(s => s.name === u);
                  return (
                    <option key={u} value={u}>
                      {sv ? (food.brand === 'Recipe' ? sv.name : `${sv.name} (${Math.round(sv.grams)}g)`) : u}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--nc-text3)', marginBottom: 10 }}>
            <BarChart3 size={13} /> {listedCount} listed nutrients · per {Math.round(amountG)} g
          </div>

          {/* Energy summary */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', marginBottom: 10 }}>Energy Summary</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 6 }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: donut, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--nc-surf)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--nc-text)' }}>{Math.round(kcal)}</div>
                <div style={{ fontSize: 10, color: 'var(--nc-text3)' }}>kcal</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {[['Protein', '#34d399', pPct, scaled('proteinG')], ['Net Carbs', '#38bdf8', cPct, (raw('__netCarbs') || 0) * s], ['Fat', '#fb923c', fPct, scaled('fatG')]].map(([l, c, p, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--nc-text2)', flex: 1 }}>{l} ({p}%)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nc-text)' }}>{(v || 0).toFixed(1)} g</span>
                </div>
              ))}
            </div>
          </div>

          {/* Macronutrient targets */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', margin: '16px 0 4px' }}>Macronutrient Targets</div>
          {targets.map(([l, v, tgt, u, dec]) => (
            <NutrientRow key={l} label={l} value={v} unit={u} dec={dec} target={tgt} indent={0} />
          ))}

          {/* Highlighted targets */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nc-text)', margin: '16px 0 4px' }}>Highlighted Targets</div>
          {highlighted.map(([l, key, tgt]) => (
            <NutrientRow key={key} label={l} value={scaled(key)} unit={MINERALS.concat(VITAMINS, CARBS).find(r => r[1] === key)?.[2] || ''} dec={1} target={tgt} indent={0} />
          ))}

          {/* Complete nutrient summary */}
          <ChevSection title="Complete Nutrient Summary" open={openSummary} onToggle={() => setOpenSummary(o => !o)}>
            {renderSection('General', GENERAL)}
            {renderSection('Vitamins', VITAMINS)}
            {renderSection('Minerals', MINERALS)}
            {renderSection('Carbohydrates', CARBS)}
            {renderSection('Lipids', LIPIDS)}
            {renderSection('Protein', PROTEIN)}
          </ChevSection>

          {/* Nutrient balance */}
          <ChevSection title="Nutrient Balance" open={openBalance} onToggle={() => setOpenBalance(o => !o)}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', padding: '12px 0' }}>
              {BALANCES.map(([l, nk, dk, max, lo, hi]) => {
                const num = scaled(nk), den = scaled(dk);
                const ratio = (num != null && den) ? num / den : 0;
                return <Gauge key={l} label={l} value={ratio} max={max} idealLow={lo} idealHigh={hi} />;
              })}
            </div>
          </ChevSection>
        </div>

        <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--nc-border)', flexShrink: 0 }}>
          <button className="nc-log-btn" disabled={!canAdd}
            onClick={() => onAdd({ amountG, unit, label: unitLabel(Number(amount) || 0, unit === 'serving' ? servingName : unit) })}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
