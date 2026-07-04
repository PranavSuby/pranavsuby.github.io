import { useState } from 'react';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';

// Log calories (and optional macros) without picking a food — stored as a single
// 100 g diary entry so it flows through computeTotals unchanged.
export default function QuickAddModal({ meals, defaultMealId, onLog, onClose }) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose);
  const [name, setName]   = useState('');
  const [kcal, setKcal]   = useState('');
  const [p, setP]         = useState('');
  const [c, setC]         = useState('');
  const [f, setF]         = useState('');
  const [mealId, setMealId] = useState(defaultMealId ?? meals[0]?.id ?? 1);

  const kcalNum = parseFloat(kcal) || 0;
  const canLog = kcalNum > 0;

  function handleLog() {
    if (!canLog) return;
    onLog({
      foodId:       null,
      mealId:       Number(mealId),
      amountG:      100,                     // entry math scales by amountG/100 → values used as-is
      unitLabel:    'quick add',
      foodName:     name.trim() || 'Quick add',
      foodCategory: 'other',
      foodKcal:     kcalNum,
      foodProteinG: parseFloat(p) || 0,
      foodCarbsG:   parseFloat(c) || 0,
      foodFatG:     parseFloat(f) || 0,
      foodFiberG:   0,
    });
  }

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-serving" ref={panelRef} {...zoneProps}>
        <div className="nc-sheet-grip" {...handleProps} />
        <div className="nc-serving-header">
          <div className="nc-serving-icon cat-other">⚡</div>
          <div>
            <div className="nc-serving-food-name">Quick Add</div>
            <div className="nc-serving-food-brand" style={{ color: 'var(--nc-text3)', marginTop: 2 }}>
              Log calories &amp; macros directly
            </div>
          </div>
        </div>

        <div className="nc-serving-body">
          <div>
            <div className="nc-serving-label">Name (optional)</div>
            <input className="nc-amount-input" style={{ width: '100%' }}
              placeholder="e.g. Restaurant meal" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <div className="nc-serving-label">Calories</div>
            <input className="nc-amount-input" style={{ width: '100%' }} type="number" inputMode="numeric"
              placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)} autoFocus />
          </div>

          <div>
            <div className="nc-serving-label">Macros (optional, grams)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Protein', p, setP], ['Carbs', c, setC], ['Fat', f, setF]].map(([lbl, val, set]) => (
                <div key={lbl} style={{ flex: 1 }}>
                  <input className="nc-amount-input" style={{ width: '100%' }} type="number" inputMode="decimal"
                    placeholder={lbl} value={val} onChange={e => set(e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--nc-text3)', textAlign: 'center', marginTop: 4 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="nc-serving-label">Meal</div>
            <select className="nc-meal-select" value={mealId} onChange={e => setMealId(e.target.value)}>
              {meals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="nc-serving-footer">
          <button className="nc-log-btn" onClick={handleLog} disabled={!canLog}>Add to Diary</button>
          <button style={{ width: '100%', marginTop: 10, padding: '10px', color: 'var(--nc-text2)', fontSize: 14 }}
            onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
