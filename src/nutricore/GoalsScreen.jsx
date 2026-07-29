import { useState, useEffect } from 'react';
import { AppScreen } from '../ui';
import { saveDefaultGoals } from './db';
import { useNutriCore } from './NCContext';
import { computeTDEE, computeTargetsFromTdee, ACTIVITY_LEVELS, GOAL_TYPES } from './tdee';
import { weekKey } from './adaptive';
import {
  kgRateToDisplay, displayRateToKg, rateUnit,
  mlToDisplayVal, waterDisplayToMl, waterUnitLabel,
} from './units';

export default function GoalsScreen() {
  const { profile: ctxProfile, updateProfile, adaptive } = useNutriCore();
  const [profile, setProfile] = useState(null);
  const [saved,   setSaved]   = useState(false);
  const [rateStr, setRateStr] = useState('');
  const [waterStr, setWaterStr] = useState('');

  // Resync local state whenever the context profile changes (writes go through the
  // context, so a change here means another screen — or our own save — updated it).
  useEffect(() => {
    const p = ctxProfile;
    setProfile(p);
    if (p) {
      const uw = p.unitWeight || 'kg';
      setRateStr(String(kgRateToDisplay(p.goalRateKgWeek || 0.25, uw)));
      setWaterStr(String(mlToDisplayVal(p.waterGoalMl || 2000, p.unitWater || 'ml')));
    }
  }, [ctxProfile]); // eslint-disable-line

  if (!profile) return <div className="nc-loader">Loading…</div>;

  const formula = computeTDEE(profile);
  const mode    = profile.coachingMode || 'adaptive';
  const useAdaptive   = mode !== 'manual' && !!adaptive?.available;
  const effectiveTdee = useAdaptive ? adaptive.tdee : formula.tdee;
  const targets = computeTargetsFromTdee(profile, effectiveTdee);
  const lastCoach = (profile.coachHistory || [])[profile.coachHistory?.length - 1];
  const uw   = profile.unitWeight || 'kg';
  const ue   = profile.unitEnergy || 'kcal';
  const uwa  = profile.unitWater  || 'ml';

  function update(key, val) {
    setProfile(p => {
      const next = { ...p, [key]: val };
      if (key === 'unitWeight') {
        setRateStr(String(kgRateToDisplay(p.goalRateKgWeek || 0.25, val)));
      }
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    // Saving IS this week's check-in when adaptive is live — stamp the week so
    // the auto-coach doesn't immediately append a duplicate history entry.
    const stamped = useAdaptive ? { ...profile, lastCoachedWeek: weekKey() } : profile;
    await updateProfile(stamped);
    await saveDefaultGoals(targets);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppScreen noPadding>
      <div className="nc-goals-screen">

        <div className="nc-section-title">Activity & Goal</div>
        <div className="nc-card">
          <div className="nc-field-row">
            <span className="nc-field-label">Activity Level</span>
            <select className="nc-field-select"
              value={profile.activityLevel}
              onChange={e => update('activityLevel', e.target.value)}>
              {ACTIVITY_LEVELS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="nc-field-row">
            <span className="nc-field-label">Goal</span>
            <select className="nc-field-select"
              value={profile.goalType}
              onChange={e => update('goalType', e.target.value)}>
              {GOAL_TYPES.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          {profile.goalType !== 'maintain' && (
            <div className="nc-field-row">
              <span className="nc-field-label">Rate ({rateUnit(uw)})</span>
              <input className="nc-field-input" type="text" inputMode="decimal"
                value={rateStr}
                onChange={e => {
                  setRateStr(e.target.value);
                  const n = parseFloat(e.target.value);
                  if (!isNaN(n) && n > 0) update('goalRateKgWeek', displayRateToKg(n, uw));
                }} />
            </div>
          )}
        </div>

        <div className="nc-section-title">Expenditure</div>
        <div className="nc-card">
          <div className="nc-field-row">
            <span className="nc-field-label">Coaching</span>
            <select className="nc-field-select"
              value={mode}
              onChange={e => update('coachingMode', e.target.value)}>
              <option value="adaptive">Adaptive (auto-adjust weekly)</option>
              <option value="manual">Manual (formula only)</option>
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--nc-text3)', padding: '8px 2px 2px', lineHeight: 1.5 }}>
            Formula TDEE: {formula.tdee} kcal · BMR {formula.bmr} kcal
            {adaptive?.available ? (
              <>
                <br />
                <span style={{ color: 'var(--nc-accent)' }}>
                  Adaptive expenditure: {adaptive.tdee} kcal
                </span>
                {' '}— from {adaptive.loggedDays} logged days &amp; {adaptive.weighInCount} weigh-ins
                ({Math.round(adaptive.confidence * 100)}% confidence)
                {useAdaptive && <>. Targets auto-adjust every Monday.</>}
              </>
            ) : (
              <>
                <br />
                Adaptive expenditure unlocks with ~1 week of data
                ({adaptive?.loggedDays ?? 0}/7 logged days, {adaptive?.weighInCount ?? 0}/3 weigh-ins
                over 7+ days). Until then the formula is used.
              </>
            )}
          </div>
        </div>

        <div className="nc-section-title">Calculated Daily Targets</div>
        <div style={{ fontSize: 12, color: 'var(--nc-text3)', marginBottom: 8 }}>
          Based on {useAdaptive ? 'adaptive' : 'formula'} expenditure of {effectiveTdee} kcal
        </div>
        <div className="nc-goal-summary">
          <div className="nc-goal-tile">
            <div className="nc-goal-tile-val" style={{ color: 'var(--nc-accent)' }}>
              {ue === 'kj' ? Math.round(targets.kcal * 4.184) : targets.kcal}
            </div>
            <div className="nc-goal-tile-lbl">{ue === 'kj' ? 'kJ' : 'kcal'}</div>
          </div>
          <div className="nc-goal-tile">
            <div className="nc-goal-tile-val">{targets.proteinG}g</div>
            <div className="nc-goal-tile-lbl">protein</div>
          </div>
          <div className="nc-goal-tile">
            <div className="nc-goal-tile-val">{targets.carbsG}g</div>
            <div className="nc-goal-tile-lbl">carbs</div>
          </div>
          <div className="nc-goal-tile">
            <div className="nc-goal-tile-val">{targets.fatG}g</div>
            <div className="nc-goal-tile-lbl">fat</div>
          </div>
        </div>
        {lastCoach && (
          <div style={{ fontSize: 12, color: 'var(--nc-text3)', marginTop: 8 }}>
            Last check-in (week of {lastCoach.week}): target set to {lastCoach.kcal} kcal
            {lastCoach.deltaKcal !== 0 && (
              <> ({lastCoach.deltaKcal > 0 ? '+' : ''}{lastCoach.deltaKcal} kcal)</>
            )}
          </div>
        )}

        <div className="nc-section-title">Hydration</div>
        <div className="nc-card">
          <div className="nc-field-row">
            <span className="nc-field-label">Daily Water Goal ({waterUnitLabel(uwa)})</span>
            <input className="nc-field-input" type="text" inputMode="decimal"
              value={waterStr}
              onChange={e => {
                setWaterStr(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n) && n > 0) update('waterGoalMl', waterDisplayToMl(n, uwa));
              }} />
          </div>
        </div>

        <button className="nc-save-btn" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save & Apply'}
        </button>

        <div style={{ height: 12 }} />
      </div>
    </AppScreen>
  );
}
