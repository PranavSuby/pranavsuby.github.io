import { useState } from 'react';
import { Trash2, Camera, Plus, ChevronDown } from 'lucide-react';
import { saveFood, deleteFood } from './db';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';
import BarcodeScanner from './BarcodeScanner';

const CATEGORIES = ['protein','dairy','grain','vegetable','fruit','fat','beverage','supplement','other'];

const blank = v => (v == null || v === 0 ? '' : v);
const round = v => +(Number(v) || 0).toFixed(2);

// FDA Daily Values for the DV% column. [label, foodKey, unit, dv, indent]
const FACTS = [
  ['Energy',       'kcal',         'kcal', null, 0],
  ['Fat',          'fatG',         'g',    78,   0],
  ['Saturated',    'satFatG',      'g',    20,   1],
  ['Trans-Fats',   'transFatG',    'g',    null, 1],
  ['Cholesterol',  'cholesterolMg','mg',   300,  0],
  ['Sodium',       'sodiumMg',     'mg',   2300, 0],
  ['Carbs',        'carbsG',       'g',    275,  0],
  ['Fiber',        'fiberG',       'g',    28,   1],
  ['Sugars',       'sugarG',       'g',    null, 1],
  ['Added Sugars', 'addedSugarG',  'g',    50,   2],
  ['Protein',      'proteinG',     'g',    50,   0],
  ['Vitamin D',    'vitaminDMcg',  'mcg',  20,   0],
  ['Calcium',      'calciumMg',    'mg',   1300, 0],
  ['Iron',         'ironMg',       'mg',   18,   0],
  ['Potassium',    'potassiumMg',  'mg',   4700, 0],
];
const ADV_VITAMINS = [
  ['Vitamin A',       'vitaminAMcg',  'mcg', 900],
  ['Vitamin C',       'vitaminCMg',   'mg',  90],
  ['Vitamin E',       'vitaminEMg',   'mg',  15],
  ['Vitamin K',       'vitaminKMcg',  'mcg', 120],
  ['B1 (Thiamine)',   'thiamineMg',   'mg',  1.2],
  ['B2 (Riboflavin)', 'riboflavinMg', 'mg',  1.3],
  ['B3 (Niacin)',     'niacinMg',     'mg',  16],
  ['B6 (Pyridoxine)', 'b6Mg',         'mg',  1.7],
  ['B9 (Folate)',     'folateMcg',    'mcg', 400],
  ['B12 (Cobalamin)', 'b12Mcg',       'mcg', 2.4],
];
const ADV_MINERALS = [
  ['Magnesium', 'magnesiumMg', 'mg',  420],
  ['Zinc',      'zincMg',      'mg',  11],
  ['Copper',    'copperMg',    'mg',  0.9],
  ['Selenium',  'seleniumMcg', 'mcg', 55],
];
const ADV_FATS = [
  ['Omega-3', 'omega3G', 'g', null],
  ['Omega-6', 'omega6G', 'g', null],
];
const ALL_KEYS = [...FACTS, ...ADV_VITAMINS, ...ADV_MINERALS, ...ADV_FATS].map(r => r[1]);

function Section({ title, open, onToggle, children, subtitle }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--nc-text)' }}>{title}</span>
        <ChevronDown size={20} style={{ color: 'var(--nc-text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && subtitle && <div style={{ fontSize: 12.5, color: 'var(--nc-text3)', margin: '2px 0 10px' }}>{subtitle}</div>}
      {open && children}
    </div>
  );
}

// `food` (optional) puts the modal in edit mode, pre-filled from a saved custom food.
export default function CustomFoodModal({ food = null, onSaved, onClose }) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose);
  const isEdit = !!food;

  const [name,     setName]     = useState(food?.name || '');
  const [brand,    setBrand]    = useState(food?.brand || '');
  const [category, setCategory] = useState(food?.category || 'other');

  const initServings = food?.servingSizes?.length
    ? food.servingSizes.map(s => ({ name: s.name, grams: String(s.grams ?? '') }))
    : [{ name: food?.servingUnit || 'serving', grams: String(food?.servingSizeG ?? '') }];
  const [servings, setServings] = useState(initServings);

  // Which basis the nutrition values below are entered for: '100g' or a serving index.
  const [perBasis, setPerBasis] = useState('100g');
  // Nutrition values held per the current basis. Stored foods are per-100 g, so on load
  // they map straight in (basis defaults to 100 g).
  const [nut, setNut] = useState(() => {
    const o = {};
    if (food) for (const k of ALL_KEYS) o[k] = blank(food[k]);
    return o;
  });

  const [barcode,  setBarcode]  = useState(food?.barcode || null);
  const [showScan, setShowScan] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  useBackClose(() => setShowScan(false), showScan);   // Back closes the scan overlay first
  const [openServing, setOpenServing] = useState(true);
  const [openFacts,   setOpenFacts]   = useState(true);
  const [openAdv,     setOpenAdv]     = useState(false);

  const field    = k => nut[k] ?? '';
  const setFieldV = (k, v) => setNut(o => ({ ...o, [k]: v }));

  const gramsOfBasis = b => (b === '100g' ? 100 : Number(servings[b]?.grams) || 100);
  const basisGrams   = gramsOfBasis(perBasis);

  // Switching the "displayed per" basis rescales the values so the food's density stays
  // constant (e.g. per-100 g 250 kcal ↔ per-30 g 75 kcal).
  function changeBasis(next) {
    const oldG = gramsOfBasis(perBasis), newG = gramsOfBasis(next);
    if (oldG > 0 && newG > 0 && oldG !== newG) {
      const r = newG / oldG;
      setNut(o => Object.fromEntries(ALL_KEYS.map(k => {
        const v = o[k];
        return [k, (v === '' || v == null) ? '' : round(Number(v) * r)];
      })));
    }
    setPerBasis(next);
  }

  function updateServing(i, key, val) { setServings(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s)); }
  function addServing() { setServings(prev => [...prev, { name: '', grams: '' }]); }
  function removeServing(i) {
    setServings(prev => prev.filter((_, idx) => idx !== i));
    if (perBasis !== '100g') setPerBasis('100g');
  }

  function applyScanned(f) {
    setShowScan(false);
    if (!f) return;
    if (f.name)     setName(f.name);
    if (f.brand)    setBrand(f.brand);
    if (f.category) setCategory(f.category);
    if (f.barcode)  setBarcode(f.barcode);
    setPerBasis('100g');
    setNut({
      kcal: blank(f.kcal), proteinG: blank(f.proteinG), carbsG: blank(f.carbsG),
      sugarG: blank(f.sugarG), fiberG: blank(f.fiberG), fatG: blank(f.fatG), sodiumMg: blank(f.sodiumMg),
    });
    setError('');
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!field('kcal')) { setError('Calories are required'); return; }
    setSaving(true);

    // Normalize the entered values (per the chosen basis) to per-100 g for storage.
    const factor = 100 / basisGrams;
    const g = k => round((Number(nut[k]) || 0) * factor);
    const sizes = servings
      .filter(s => (s.name || '').trim())
      .map(s => ({ name: s.name.trim(), grams: round(Number(s.grams) || 0) || 100 }));
    const primary = sizes[0] || { name: 'serving', grams: 100 };

    const payload = {
      ...(food || {}),
      name: name.trim(), brand: brand.trim() || null, category,
      sourceDb: food?.sourceDb || 'custom', isCustom: true, barcode: barcode || null,
      servingSizeG: primary.grams, servingUnit: primary.name,
      servingSizes: sizes.length ? sizes : [{ name: 'serving', grams: 100 }],
    };
    for (const k of ALL_KEYS) payload[k] = g(k);
    const id = await saveFood(payload);
    onSaved({ ...payload, id: payload.id ?? id });
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Delete "${food.name}"?`)) return;
    await deleteFood(food.id);
    onSaved(null);
  }

  function nutRow(label, fieldKey, unit, dv, indent) {
    const v = field(fieldKey);
    const dvPct = (dv && v !== '' && v != null) ? Math.round(Number(v) / dv * 100) : null;
    return (
      <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--nc-border)' }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: indent ? 400 : 600, color: indent ? 'var(--nc-text2)' : 'var(--nc-text)', paddingLeft: (indent || 0) * 14 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input className="nc-newfood-box" type="number" min="0" step="0.1" inputMode="decimal" placeholder="–"
            value={v} onChange={e => setFieldV(fieldKey, e.target.value)} />
          <span style={{ fontSize: 13, color: 'var(--nc-text2)', width: 30 }}>{unit}</span>
        </div>
        {dv != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="nc-newfood-box nc-newfood-dv">{dvPct == null ? 'DV' : dvPct}</div>
            <span style={{ fontSize: 13, color: 'var(--nc-text2)', width: 12 }}>%</span>
          </div>
        ) : <div style={{ width: 78 }} />}
      </div>
    );
  }

  const perOptions = [['100g', '100 g'], ...servings.map((s, i) => [String(i), `${(s.name || 'serving').trim() || 'serving'}${s.grams ? ` (${s.grams} g)` : ''}`])];

  return (
    <div className="nc-picker" ref={panelRef}>
      <style>{`
        .nc-newfood-box { width: 68px; padding: 8px 8px; border-radius: 10px; border: 1px solid var(--nc-border);
          background: var(--nc-surf); color: var(--nc-text); font-size: 16px; text-align: right; }
        .nc-newfood-dv { display: flex; align-items: center; justify-content: flex-end; color: var(--nc-text3); }
      `}</style>
      <div className="nc-sheet-grip" {...handleProps} />
      <div className="nc-picker-header" {...zoneProps}>
        <div className="nc-picker-title-row">
          <span className="nc-picker-title">{isEdit ? 'Edit Food' : 'New Food'}</span>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 20, border: 'none', background: 'var(--nc-accent)', color: '#06281a', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="nc-picker-list" style={{ padding: '8px 16px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--nc-warn)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: 'var(--nc-warn)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!isEdit && (
          <button onClick={() => setShowScan(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', margin: '4px 0 8px', padding: 12, borderRadius: 10, background: 'var(--nc-surf2)', border: '1px solid var(--nc-border)', color: 'var(--nc-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Camera size={17} /> Scan Barcode to Autofill
          </button>
        )}

        {/* Food Details */}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nc-text)', marginTop: 10 }}>Food Details</div>
        <div className="nc-card" style={{ marginTop: 8 }}>
          <div className="nc-field-row">
            <span className="nc-field-label">Food name *</span>
            <input className="nc-field-input" style={{ width: 170 }} placeholder="e.g. Clif Bar, Peanut"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="nc-field-row">
            <span className="nc-field-label">Brand</span>
            <input className="nc-field-input" style={{ width: 170 }} placeholder="Optional"
              value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
        </div>

        {/* Serving Sizes */}
        <Section title="Serving Sizes" open={openServing} onToggle={() => setOpenServing(o => !o)}
          subtitle="Enter the serving size listed on your product's packaging. Add more for alternate portions.">
          <div className="nc-card">
            {servings.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < servings.length - 1 ? '1px solid var(--nc-border)' : 'none' }}>
                <input className="nc-amount-input" style={{ flex: 1, fontSize: 16, padding: '8px 10px', textAlign: 'left' }}
                  placeholder={i === 0 ? 'serving' : 'e.g. 1 bar, 3 tsp'} value={s.name} onChange={e => updateServing(i, 'name', e.target.value)} />
                <input className="nc-amount-input" type="number" min="0" step="0.1" inputMode="decimal" style={{ width: 78, fontSize: 16, padding: '8px 10px' }}
                  placeholder="– g" value={s.grams} onChange={e => updateServing(i, 'grams', e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--nc-text3)' }}>g</span>
                <button style={{ width: 26, color: 'var(--nc-text3)', flexShrink: 0, opacity: servings.length === 1 ? 0.3 : 1 }} disabled={servings.length === 1} onClick={() => removeServing(i)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={addServing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: 9, background: 'none', border: 'none', color: 'var(--nc-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={15} /> Add serving size
            </button>
          </div>
        </Section>

        {/* Nutrition Details */}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nc-text)', marginTop: 18 }}>Nutrition Details</div>
        <div className="nc-card" style={{ marginTop: 8 }}>
          <div className="nc-field-row" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Nutrition entered per</span>
            <select className="nc-field-select" value={perBasis} onChange={e => changeBasis(e.target.value)}>
              {perOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Nutrition Facts */}
        <Section title="Nutrition Facts" open={openFacts} onToggle={() => setOpenFacts(o => !o)}>
          <div className="nc-card">
            {FACTS.map(([label, key, unit, dv, indent]) => nutRow(label, key, unit, dv, indent))}
          </div>
        </Section>

        {/* Advanced Nutrition */}
        <Section title="Advanced Nutrition" open={openAdv} onToggle={() => setOpenAdv(o => !o)}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0' }}>Vitamins</div>
          <div className="nc-card">
            {ADV_VITAMINS.map(([label, key, unit, dv]) => nutRow(label, key, unit, dv))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 4px' }}>Minerals</div>
          <div className="nc-card">
            {ADV_MINERALS.map(([label, key, unit, dv]) => nutRow(label, key, unit, dv))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 4px' }}>Fats</div>
          <div className="nc-card">
            {ADV_FATS.map(([label, key, unit, dv]) => nutRow(label, key, unit, dv))}
          </div>
        </Section>

        {/* Category */}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nc-text)', marginTop: 18 }}>Category</div>
        <div className="nc-card" style={{ marginTop: 8 }}>
          <div className="nc-field-row" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Icon category</span>
            <select className="nc-field-select" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {isEdit && (
          <button onClick={handleDelete}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 16, padding: 12, background: 'none', border: 'none', color: 'var(--nc-warn)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Trash2 size={15} /> Delete Food
          </button>
        )}
      </div>

      {showScan && (
        <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowScan(false); }}>
          <div className="nc-picker">
            <div className="nc-sheet-grip" />
            <div className="nc-picker-header">
              <div className="nc-picker-title-row">
                <span className="nc-picker-title">Scan Barcode</span>
                <button className="nc-picker-close" onClick={() => setShowScan(false)}>✕</button>
              </div>
            </div>
            <div className="nc-picker-list">
              <BarcodeScanner onFound={applyScanned} onNotFound={() => setShowScan(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
