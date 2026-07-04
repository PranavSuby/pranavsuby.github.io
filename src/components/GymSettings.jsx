import { Sheet, BackupPanel } from '../ui';
import { useApp } from '../contexts/AppContext';

// Global gym settings home: units, rest, keep-awake + data backup. (RPE/RIR tracking
// lives in the in-workout Settings sheet, where it actually takes effect.)
// Back-button handling comes from the shared Sheet (it registers with the nav stack).
export default function GymSettings({ open, onClose }) {
  const { settings, updateSetting } = useApp();

  return (
    <Sheet open={open} onClose={onClose} title="Settings" tall>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8 }}>
        <Row label="Units">
          <Segment
            options={[{ v: 'kg', l: 'kg' }, { v: 'lbs', l: 'lbs' }]}
            value={settings.units}
            onChange={v => updateSetting('units', v)}
          />
        </Row>

        <Row label="Default rest timer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number" min={0}
              value={settings.defaultRest ?? 90}
              onChange={e => updateSetting('defaultRest', Number(e.target.value))}
              style={{
                width: 72, padding: '7px 10px', textAlign: 'center',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 16,
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>sec</span>
          </div>
        </Row>

        <Row label="Keep screen awake during workout">
          <Toggle on={!!settings.keepAwake} onChange={v => updateSetting('keepAwake', v)} />
        </Row>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 12px' }}>
          Data &amp; Backup
        </div>
        <BackupPanel accent="var(--accent)" />
      </div>
    </Sheet>
  );
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 15, color: 'var(--text)' }}>{label}</span>
      {children}
    </div>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2, gap: 2 }}>
      {options.map(({ v, l }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            background: value === v ? 'var(--accent)' : 'transparent',
            color: value === v ? '#fff' : 'var(--text2)',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', position: 'relative',
        background: on ? 'var(--accent)' : 'var(--bg3)', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
      }} />
    </button>
  );
}
