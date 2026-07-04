import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { BackupPanel } from '../ui';
import { useNutriCore } from './NCContext';
import {
  kgToDisplay, displayToKg, weightUnit,
  cmToFtIn, ftInToCm,
} from './units';

export default function SettingsScreen({ onClose, onOpenGoals }) {
  const { profile: ctxProfile, updateProfile } = useNutriCore();
  const [profile,   setProfile]   = useState(null);
  const [saved,     setSaved]     = useState(false);
  const [weightStr, setWeightStr] = useState('');
  const [heightStr, setHeightStr] = useState('');
  const [heightFt,  setHeightFt]  = useState('');
  const [heightIn,  setHeightIn]  = useState('');

  function syncHeightDisplay(cm, uh) {
    if (uh === 'ft') {
      const { ft, inches } = cmToFtIn(cm || 175);
      setHeightFt(String(ft));
      setHeightIn(String(inches));
    } else {
      setHeightStr(String(cm || 175));
    }
  }

  // Resync local state whenever the context profile changes (writes go through the
  // context, so a change here means another screen — or our own save — updated it).
  useEffect(() => {
    const p = ctxProfile;
    setProfile(p);
    if (p) {
      const uw = p.unitWeight || 'kg';
      const uh = p.unitHeight || 'cm';
      setWeightStr(String(kgToDisplay(p.weightKg, uw)));
      syncHeightDisplay(p.heightCm, uh);
    }
  }, [ctxProfile]); // eslint-disable-line

  if (!profile) return null;

  const uw  = profile.unitWeight || 'kg';
  const uh  = profile.unitHeight || 'cm';
  const uwa = (profile.unitWater === 'cups' ? 'ml' : profile.unitWater) || 'ml';
  const ue  = profile.unitEnergy || 'kcal';

  const ageYears = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : '—';

  function update(key, val) {
    setProfile(p => {
      const next = { ...p, [key]: val };
      if (key === 'unitWeight') {
        setWeightStr(String(kgToDisplay(p.weightKg, val)));
      }
      if (key === 'unitHeight') {
        syncHeightDisplay(p.heightCm, val);
      }
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    await updateProfile(profile);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--nc-bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px',
        background: 'var(--nc-surf)', borderBottom: '1px solid var(--nc-border)',
        flexShrink: 0,
      }}>
        <button className="nc-back-btn" onClick={onClose}>
          <X size={15} />
          Close
        </button>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--nc-text)' }}>Settings</span>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 16px', borderRadius: 20,
            background: saved ? 'var(--nc-surf2)' : 'var(--nc-accent)',
            color: saved ? 'var(--nc-accent)' : '#0F1117',
            fontSize: 13, fontWeight: 700,
            border: saved ? '1px solid var(--nc-accent)' : 'none',
          }}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Body */}
      <div className="nc-screen">
        <div className="nc-goals-screen">

          {onOpenGoals && (
            <>
              <div className="nc-section-title">Goals</div>
              <div className="nc-card" style={{ padding: 0 }}>
                <button onClick={onOpenGoals}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nc-text)', fontSize: 15 }}>
                  <span>Goals &amp; Targets</span>
                  <span style={{ color: 'var(--nc-text3)' }}>›</span>
                </button>
              </div>
            </>
          )}

          <div className="nc-section-title">Personal Info</div>
          <div className="nc-card">
            <div className="nc-field-row">
              <span className="nc-field-label">Sex</span>
              <div className="nc-segment">
                {['male', 'female', 'other'].map(s => (
                  <button key={s}
                    className={`nc-seg-btn${profile.sex === s ? ' active' : ''}`}
                    onClick={() => update('sex', s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Date of Birth</span>
              <input className="nc-field-input" type="date" style={{ width: 140 }}
                value={profile.dateOfBirth || ''}
                onChange={e => update('dateOfBirth', e.target.value)} />
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Age</span>
              <span className="nc-field-value">{ageYears} yrs</span>
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Height ({uh === 'ft' ? 'ft / in' : 'cm'})</span>
              {uh === 'ft' ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input className="nc-field-input" type="text" inputMode="numeric"
                    style={{ width: 52 }}
                    value={heightFt}
                    onChange={e => {
                      setHeightFt(e.target.value);
                      const ft = parseInt(e.target.value, 10);
                      const ins = parseInt(heightIn, 10) || 0;
                      if (!isNaN(ft) && ft >= 0) update('heightCm', ftInToCm(ft, ins));
                    }} />
                  <span style={{ color: 'var(--nc-text2)', fontSize: 13 }}>ft</span>
                  <input className="nc-field-input" type="text" inputMode="numeric"
                    style={{ width: 52 }}
                    value={heightIn}
                    onChange={e => {
                      setHeightIn(e.target.value);
                      const ft = parseInt(heightFt, 10) || 0;
                      const ins = parseInt(e.target.value, 10);
                      if (!isNaN(ins) && ins >= 0) update('heightCm', ftInToCm(ft, ins));
                    }} />
                  <span style={{ color: 'var(--nc-text2)', fontSize: 13 }}>in</span>
                </div>
              ) : (
                <input className="nc-field-input" type="text" inputMode="numeric"
                  value={heightStr}
                  onChange={e => {
                    setHeightStr(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n > 0) update('heightCm', n);
                  }} />
              )}
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Weight ({weightUnit(uw)})</span>
              <input className="nc-field-input" type="text" inputMode="decimal"
                value={weightStr}
                onChange={e => {
                  setWeightStr(e.target.value);
                  const n = parseFloat(e.target.value);
                  if (!isNaN(n) && n > 0) update('weightKg', displayToKg(n, uw));
                }} />
            </div>
          </div>

          <div className="nc-section-title">Units</div>
          <div className="nc-card">
            <div className="nc-field-row">
              <span className="nc-field-label">Weight</span>
              <div className="nc-segment">
                {[{ v: 'kg', l: 'kg' }, { v: 'lbs', l: 'lbs' }].map(({ v, l }) => (
                  <button key={v}
                    className={`nc-seg-btn${uw === v ? ' active' : ''}`}
                    onClick={() => update('unitWeight', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Height</span>
              <div className="nc-segment">
                {[{ v: 'cm', l: 'cm' }, { v: 'ft', l: 'ft / in' }].map(({ v, l }) => (
                  <button key={v}
                    className={`nc-seg-btn${uh === v ? ' active' : ''}`}
                    onClick={() => update('unitHeight', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Water</span>
              <div className="nc-segment">
                {[{ v: 'ml', l: 'mL' }, { v: 'floz', l: 'fl oz' }].map(({ v, l }) => (
                  <button key={v}
                    className={`nc-seg-btn${uwa === v ? ' active' : ''}`}
                    onClick={() => update('unitWater', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="nc-field-row">
              <span className="nc-field-label">Energy</span>
              <div className="nc-segment">
                {[{ v: 'kcal', l: 'kcal' }, { v: 'kj', l: 'kJ' }].map(({ v, l }) => (
                  <button key={v}
                    className={`nc-seg-btn${ue === v ? ' active' : ''}`}
                    onClick={() => update('unitEnergy', v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="nc-section-title">Data &amp; Backup</div>
          <div className="nc-card" style={{ padding: 14 }}>
            <BackupPanel accent="var(--nc-accent)" />
          </div>

          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
