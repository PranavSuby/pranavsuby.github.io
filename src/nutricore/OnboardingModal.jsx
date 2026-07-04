import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { computeTDEE, ACTIVITY_LEVELS, GOAL_TYPES } from './tdee';
import { saveDefaultGoals } from './db';
import { useNutriCore } from './NCContext';
import {
  kgToDisplay, displayToKg, weightUnit,
  kgRateToDisplay, displayRateToKg, rateUnit,
  cmToFtIn, ftInToCm,
} from './units';

const STEPS = ['welcome', 'units', 'goal', 'info', 'activity', 'preview'];

export default function OnboardingModal({ onComplete }) {
  const { updateProfile } = useNutriCore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    unitWeight:     'kg',
    unitHeight:     'cm',
    unitWater:      'ml',
    unitEnergy:     'kcal',
    goalType:       'maintain',
    goalRateKgWeek: 0.25,
    sex:            'male',
    dateOfBirth:    '1995-01-01',
    heightCm:       175,
    weightKg:       75,
    activityLevel:  'moderatelyActive',
  });

  // Raw string states so users can freely clear and retype numeric fields
  const [heightStr, setHeightStr] = useState('175');
  const [heightFt,  setHeightFt]  = useState(() => String(cmToFtIn(175).ft));
  const [heightIn,  setHeightIn]  = useState(() => String(cmToFtIn(175).inches));
  const [weightStr, setWeightStr] = useState('75');
  const [rateStr,   setRateStr]   = useState('0.25');

  function syncHeightDisplay(cm, uh) {
    if (uh === 'ft') {
      const { ft, inches } = cmToFtIn(cm || 175);
      setHeightFt(String(ft));
      setHeightIn(String(inches));
    } else {
      setHeightStr(String(cm || 175));
    }
  }

  function set(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'unitWeight') {
        setWeightStr(String(kgToDisplay(f.weightKg, value)));
        setRateStr(String(kgRateToDisplay(f.goalRateKgWeek, value)));
      }
      if (field === 'unitHeight') {
        syncHeightDisplay(f.heightCm, value);
      }
      return next;
    });
  }

  const tdee = computeTDEE({
    sex:            form.sex,
    dateOfBirth:    form.dateOfBirth,
    heightCm:       Number(form.heightCm) || 175,
    weightKg:       Number(form.weightKg) || 75,
    activityLevel:  form.activityLevel,
    goalType:       form.goalType,
    goalRateKgWeek: Number(form.goalRateKgWeek) || 0,
  });

  async function handleComplete() {
    const profile = {
      ...form,
      heightCm:       Number(form.heightCm),
      weightKg:       Number(form.weightKg),
      goalRateKgWeek: Number(form.goalRateKgWeek),
      waterGoalMl:    2000,
      onboardingComplete: true,
    };
    await updateProfile(profile);
    await saveDefaultGoals({ kcal: tdee.kcal, proteinG: tdee.proteinG, carbsG: tdee.carbsG, fatG: tdee.fatG });
    onComplete();
  }

  function next() { setStep(s => Math.min(STEPS.length - 1, s + 1)); }
  function prev() { setStep(s => Math.max(0, s - 1)); }

  const uw  = form.unitWeight;
  const uh  = form.unitHeight;
  const uwa = form.unitWater;
  const ue  = form.unitEnergy;

  return (
    <div className="nc-modal-overlay" style={{ justifyContent: 'flex-end', zIndex: 1000 }}>
      <div className="nc-onboarding">
        {/* Progress dots */}
        <div className="nc-onboard-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`nc-onboard-dot${i <= step ? ' done' : ''}`} />
          ))}
        </div>

        <div className="nc-onboard-body">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-emoji">🥗</div>
              <div className="nc-onboard-title">Welcome to NutriCore</div>
              <div className="nc-onboard-sub">
                Track your nutrition, hit your macros, and reach your goals — all offline.
              </div>
              <div className="nc-onboard-sub" style={{ marginTop: 12 }}>
                Let's set up your daily targets. It takes about a minute.
              </div>
            </div>
          )}

          {/* Step 1: Units */}
          {step === 1 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-title">Your Preferences</div>
              <div className="nc-onboard-sub" style={{ marginBottom: 20 }}>
                Choose the units you're most comfortable with.
              </div>
              <div className="nc-onboard-fields">
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Weight</label>
                  <div className="nc-segment">
                    {[{ v: 'kg', l: 'kg' }, { v: 'lbs', l: 'lbs' }].map(({ v, l }) => (
                      <button key={v}
                        className={`nc-seg-btn${uw === v ? ' active' : ''}`}
                        onClick={() => set('unitWeight', v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Height</label>
                  <div className="nc-segment">
                    {[{ v: 'cm', l: 'cm' }, { v: 'ft', l: 'ft / in' }].map(({ v, l }) => (
                      <button key={v}
                        className={`nc-seg-btn${uh === v ? ' active' : ''}`}
                        onClick={() => set('unitHeight', v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Water</label>
                  <div className="nc-segment">
                    {[{ v: 'ml', l: 'mL' }, { v: 'floz', l: 'fl oz' }].map(({ v, l }) => (
                      <button key={v}
                        className={`nc-seg-btn${uwa === v ? ' active' : ''}`}
                        onClick={() => set('unitWater', v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Energy</label>
                  <div className="nc-segment">
                    {[{ v: 'kcal', l: 'kcal' }, { v: 'kj', l: 'kJ' }].map(({ v, l }) => (
                      <button key={v}
                        className={`nc-seg-btn${ue === v ? ' active' : ''}`}
                        onClick={() => set('unitEnergy', v)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Goal */}
          {step === 2 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-title">What's your goal?</div>
              <div className="nc-onboard-goal-grid">
                {GOAL_TYPES.map(g => (
                  <button
                    key={g.value}
                    className={`nc-onboard-goal-btn${form.goalType === g.value ? ' active' : ''}`}
                    onClick={() => set('goalType', g.value)}
                  >
                    <div className="nc-onboard-goal-icon">
                      {g.value === 'lose' ? '↓' : g.value === 'gain' ? '↑' : '→'}
                    </div>
                    <div className="nc-onboard-goal-label">{g.label}</div>
                  </button>
                ))}
              </div>
              {form.goalType !== 'maintain' && (
                <div className="nc-onboard-field" style={{ marginTop: 20 }}>
                  <label className="nc-onboard-field-label">Rate ({rateUnit(uw)})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="nc-field-input"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={rateStr}
                    onChange={e => {
                      setRateStr(e.target.value);
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n > 0) set('goalRateKgWeek', displayRateToKg(n, uw));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Personal info */}
          {step === 3 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-title">About You</div>
              <div className="nc-onboard-fields">
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Sex</label>
                  <div className="nc-segment">
                    {['male', 'female', 'other'].map(s => (
                      <button
                        key={s}
                        className={`nc-seg-btn${form.sex === s ? ' active' : ''}`}
                        onClick={() => set('sex', s)}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nc-onboard-field">
                  <label className="nc-onboard-field-label">Date of Birth</label>
                  <input
                    type="date"
                    className="nc-field-input"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={form.dateOfBirth}
                    onChange={e => set('dateOfBirth', e.target.value)}
                  />
                </div>
                <div className="nc-onboard-field-row">
                  <div className="nc-onboard-field">
                    <label className="nc-onboard-field-label">
                      Height ({uh === 'ft' ? 'ft / in' : 'cm'})
                    </label>
                    {uh === 'ft' ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="text" inputMode="numeric"
                          className="nc-field-input"
                          style={{ width: '100%', textAlign: 'left' }}
                          value={heightFt}
                          onChange={e => {
                            setHeightFt(e.target.value);
                            const ft = parseInt(e.target.value, 10);
                            const ins = parseInt(heightIn, 10) || 0;
                            if (!isNaN(ft) && ft >= 0) set('heightCm', ftInToCm(ft, ins));
                          }}
                        />
                        <span style={{ color: 'var(--nc-text2)', fontSize: 13, flexShrink: 0 }}>ft</span>
                        <input
                          type="text" inputMode="numeric"
                          className="nc-field-input"
                          style={{ width: '100%', textAlign: 'left' }}
                          value={heightIn}
                          onChange={e => {
                            setHeightIn(e.target.value);
                            const ft = parseInt(heightFt, 10) || 0;
                            const ins = parseInt(e.target.value, 10);
                            if (!isNaN(ins) && ins >= 0) set('heightCm', ftInToCm(ft, ins));
                          }}
                        />
                        <span style={{ color: 'var(--nc-text2)', fontSize: 13, flexShrink: 0 }}>in</span>
                      </div>
                    ) : (
                      <input
                        type="text" inputMode="numeric"
                        className="nc-field-input"
                        style={{ width: '100%', textAlign: 'left' }}
                        value={heightStr}
                        onChange={e => {
                          setHeightStr(e.target.value);
                          const n = parseInt(e.target.value, 10);
                          if (!isNaN(n) && n > 0) set('heightCm', n);
                        }}
                      />
                    )}
                  </div>
                  <div className="nc-onboard-field">
                    <label className="nc-onboard-field-label">Weight ({weightUnit(uw)})</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="nc-field-input"
                      style={{ width: '100%', textAlign: 'left' }}
                      value={weightStr}
                      onChange={e => {
                        setWeightStr(e.target.value);
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n) && n > 0) set('weightKg', displayToKg(n, uw));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Activity */}
          {step === 4 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-title">Activity Level</div>
              <div className="nc-onboard-activity-list">
                {ACTIVITY_LEVELS.map(a => (
                  <button
                    key={a.value}
                    className={`nc-onboard-activity-btn${form.activityLevel === a.value ? ' active' : ''}`}
                    onClick={() => set('activityLevel', a.value)}
                  >
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div className="nc-onboard-activity-label">{a.label}</div>
                      <div className="nc-onboard-activity-desc">{a.desc}</div>
                    </div>
                    {form.activityLevel === a.value && (
                      <ChevronRight size={15} style={{ color: 'var(--nc-accent)', flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {step === 5 && (
            <div className="nc-onboard-step">
              <div className="nc-onboard-title">Your Daily Targets</div>
              <div className="nc-onboard-sub">Based on your profile using Mifflin-St Jeor</div>
              <div className="nc-goal-summary" style={{ marginTop: 20 }}>
                <div className="nc-goal-tile">
                  <div className="nc-goal-tile-val">
                    {ue === 'kj' ? Math.round(tdee.kcal * 4.184) : tdee.kcal}
                  </div>
                  <div className="nc-goal-tile-lbl">{ue === 'kj' ? 'kJ' : 'kcal'}</div>
                </div>
                <div className="nc-goal-tile">
                  <div className="nc-goal-tile-val" style={{ color: 'var(--nc-accent)' }}>{tdee.proteinG}g</div>
                  <div className="nc-goal-tile-lbl">protein</div>
                </div>
                <div className="nc-goal-tile">
                  <div className="nc-goal-tile-val" style={{ color: 'var(--nc-a2)' }}>{tdee.carbsG}g</div>
                  <div className="nc-goal-tile-lbl">carbs</div>
                </div>
                <div className="nc-goal-tile">
                  <div className="nc-goal-tile-val" style={{ color: 'var(--nc-a3)' }}>{tdee.fatG}g</div>
                  <div className="nc-goal-tile-lbl">fat</div>
                </div>
              </div>
              <div className="nc-onboard-sub" style={{ marginTop: 14, fontSize: 12 }}>
                BMR {tdee.bmr} kcal · TDEE {tdee.tdee} kcal
              </div>
              <div className="nc-onboard-sub" style={{ fontSize: 11, marginTop: 8, color: 'var(--nc-text3)' }}>
                You can adjust these anytime in the Goals tab.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="nc-onboard-footer">
          {step > 0 && (
            <button className="nc-onboard-back" onClick={prev}>Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="nc-log-btn" style={{ flex: 1 }} onClick={next}>
              {step === 0 ? 'Get Started' : 'Next'}
            </button>
          ) : (
            <button className="nc-log-btn" style={{ flex: 1 }} onClick={handleComplete}>
              Save & Start Tracking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
