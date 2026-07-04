import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { computePlates, warmupSets, BAR_DEFAULTS } from '../utils/plates';

const PLATE_COLORS = {
  25: '#EF4444', 20: '#3B82F6', 15: '#F59E0B', 10: '#22C55E',
  5: '#E5E7EB', 2.5: '#9CA3AF', 1.25: '#6B7280',
  45: '#3B82F6', 35: '#F59E0B', 25: '#EF4444', // lbs reuse where keys differ
};

// Per-exercise plate + warm-up helper. `initialWeight` prefills from the working set.
export default function PlateWarmupModal({ initialWeight = 0, unit = 'kg', onClose }) {
  const [tab, setTab] = useState('plates');
  const [weight, setWeight] = useState(initialWeight > 0 ? String(initialWeight) : '');
  const [bar, setBar] = useState(BAR_DEFAULTS[unit] ?? 20);

  const target = parseFloat(weight) || 0;
  const plates = useMemo(() => computePlates(target, bar, unit), [target, bar, unit]);
  const warmups = useMemo(() => warmupSets(target, bar, unit), [target, bar, unit]);

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <span style={S.title}>Plates &amp; Warm-up</span>
          <button style={S.close} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Inputs */}
        <div style={S.inputs}>
          <Field label={`Target (${unit})`}>
            <input type="number" inputMode="decimal" value={weight} autoFocus
              onChange={e => setWeight(e.target.value)} style={S.input} />
          </Field>
          <Field label={`Bar (${unit})`}>
            <input type="number" inputMode="decimal" value={bar}
              onChange={e => setBar(parseFloat(e.target.value) || 0)} style={S.input} />
          </Field>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[['plates', 'Plates'], ['warmup', 'Warm-up']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ ...S.tab, ...(tab === id ? S.tabOn : {}) }}>{label}</button>
          ))}
        </div>

        {tab === 'plates' ? (
          <div style={{ paddingTop: 14 }}>
            {target <= 0 ? (
              <Empty text="Enter a target weight." />
            ) : !plates.loadable && plates.perSide.length === 0 ? (
              <Empty text={target <= bar ? 'Target is at or below the bar.' : 'Not loadable with standard plates.'} />
            ) : (
              <>
                <div style={S.barLabel}>Per side of the bar</div>
                <div style={S.plateRow}>
                  {plates.perSide.map(({ weight: w, count }) => (
                    <div key={w} style={S.plateChip}>
                      <span style={{ ...S.plateDot, background: PLATE_COLORS[w] || '#6B7280' }} />
                      {count} × {w}
                    </div>
                  ))}
                </div>
                {plates.leftover > 0 && (
                  <div style={S.leftover}>+{plates.leftover} {unit}/side can’t be matched exactly</div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ paddingTop: 14 }}>
            {warmups.length === 0 ? (
              <Empty text="Enter a working weight above the bar to build a warm-up." />
            ) : (
              <div style={S.warmList}>
                {warmups.map((s, i) => (
                  <div key={i} style={S.warmRow}>
                    <span style={S.warmPct}>{s.pct}%</span>
                    <span style={S.warmWeight}>{s.weight} {unit}</span>
                    <span style={S.warmReps}>× {s.reps}</span>
                  </div>
                ))}
                <div style={S.warmRowWork}>
                  <span style={S.warmPct}>100%</span>
                  <span style={S.warmWeight}>{target} {unit}</span>
                  <span style={S.warmReps}>work set</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={S.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{text}</div>;
}

const S = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  box: { width: '100%', maxWidth: 460, background: 'var(--bg2)', borderRadius: '18px 18px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '16px 18px calc(28px + var(--safe-bottom))' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  close: { background: 'var(--bg3)', border: 'none', color: 'var(--text2)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  inputs: { display: 'flex', gap: 10, marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, fontWeight: 600 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 16, textAlign: 'center' },
  tabs: { display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, gap: 2 },
  tab: { flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  tabOn: { background: 'var(--accent)', color: '#fff' },
  barLabel: { fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 },
  plateRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  plateChip: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  plateDot: { width: 12, height: 12, borderRadius: '50%', display: 'inline-block' },
  leftover: { marginTop: 12, fontSize: 12.5, color: 'var(--warmup)' },
  warmList: { display: 'flex', flexDirection: 'column', gap: 8 },
  warmRow: { display: 'grid', gridTemplateColumns: '60px 1fr auto', alignItems: 'center', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10 },
  warmRowWork: { display: 'grid', gridTemplateColumns: '60px 1fr auto', alignItems: 'center', padding: '11px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10 },
  warmPct: { fontSize: 12, color: 'var(--text3)', fontWeight: 700 },
  warmWeight: { fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  warmReps: { fontSize: 13, color: 'var(--text2)', fontWeight: 600 },
};
