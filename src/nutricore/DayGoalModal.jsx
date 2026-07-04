import { useState } from 'react';
import useBackClose from '../ui/navStack';

// Per-date calorie cycling: override the day's targets (e.g. a higher allowance on
// training days, lower on rest days) without changing the default goal.
export default function DayGoalModal({ date, current, isOverride, onSave, onReset, onClose }) {
  useBackClose(onClose);
  const [kcal, setKcal] = useState(String(Math.round(current.kcal || 0)));
  const [p, setP] = useState(String(Math.round(current.proteinG || 0)));
  const [c, setC] = useState(String(Math.round(current.carbsG || 0)));
  const [f, setF] = useState(String(Math.round(current.fatG || 0)));

  const prettyDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  function handleSave() {
    onSave({
      kcal:     parseFloat(kcal) || 0,
      proteinG: parseFloat(p) || 0,
      carbsG:   parseFloat(c) || 0,
      fatG:     parseFloat(f) || 0,
    });
  }

  const fields = [
    ['Calories', kcal, setKcal, 'kcal'],
    ['Protein', p, setP, 'g'],
    ['Carbs', c, setC, 'g'],
    ['Fat', f, setF, 'g'],
  ];

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-serving">
        <div className="nc-serving-header">
          <div className="nc-serving-icon cat-other">🎯</div>
          <div>
            <div className="nc-serving-food-name">Targets for {prettyDate}</div>
            <div className="nc-serving-food-brand" style={{ color: 'var(--nc-text3)', marginTop: 2 }}>
              {isOverride ? 'Custom targets set for this day' : 'Override just this day’s targets'}
            </div>
          </div>
        </div>

        <div className="nc-serving-body">
          {fields.map(([label, val, set, unit]) => (
            <div key={label}>
              <div className="nc-serving-label">{label} ({unit})</div>
              <input className="nc-amount-input" style={{ width: '100%' }} type="number" inputMode="decimal"
                value={val} onChange={e => set(e.target.value)} />
            </div>
          ))}
        </div>

        <div className="nc-serving-footer">
          <button className="nc-log-btn" onClick={handleSave}>Save day targets</button>
          {isOverride && (
            <button
              style={{ width: '100%', marginTop: 10, padding: '10px', color: 'var(--nc-warn)', fontSize: 14 }}
              onClick={onReset}>
              Reset to default goal
            </button>
          )}
          <button style={{ width: '100%', marginTop: 6, padding: '10px', color: 'var(--nc-text2)', fontSize: 14 }}
            onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
