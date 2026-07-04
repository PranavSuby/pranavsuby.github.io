import { useEffect } from 'react';

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', color: 'var(--text)', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 500, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
      {message}
    </div>
  );
}

// ── DashboardTile ─────────────────────────────────────────────────────────────
export function DashboardTile({ icon: Icon, label, onTap }) {
  return (
    <button onClick={onTap} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s', width: '100%' }}>
      <Icon size={24} color="var(--accent)" />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
    </button>
  );
}
