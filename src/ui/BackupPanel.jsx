import { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import Button from './Button';
import { downloadBackup, importBackupFile } from '../utils/backup';

// Self-contained Export / Import panel. Themes automatically via --ui-* vars, so it
// drops into any app's settings screen. Restore replaces existing data, so it runs
// through an explicit confirm step before touching the database.
export default function BackupPanel({ accent }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null);          // 'export' | 'import' | null
  const [msg, setMsg] = useState(null);            // { kind, text }
  const [pending, setPending] = useState(null);    // File awaiting confirm

  const ac = accent || 'var(--ui-accent)';

  async function handleExport() {
    setBusy('export'); setMsg(null);
    try {
      const n = await downloadBackup();
      setMsg({ kind: 'ok', text: `Backup downloaded — ${n.toLocaleString()} records saved.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Export failed.' });
    } finally { setBusy(null); }
  }

  function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    setPending(file);
  }

  async function confirmImport() {
    const file = pending;
    setPending(null);
    setBusy('import'); setMsg(null);
    try {
      const { restored } = await importBackupFile(file);
      setMsg({ kind: 'ok', text: `Restored ${restored.toLocaleString()} records. Reloading…` });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Import failed.' });
      setBusy(null);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <ShieldCheck size={16} color={ac} />
        <span style={S.headText}>Your data lives only on this device. Back it up regularly.</span>
      </div>

      <div style={S.row}>
        <Button
          variant="secondary" fullWidth icon={busy === 'export' ? Spinner : Download}
          onClick={handleExport} disabled={!!busy}
        >
          {busy === 'export' ? 'Exporting…' : 'Export backup'}
        </Button>
        <Button
          variant="secondary" fullWidth icon={busy === 'import' ? Spinner : Upload}
          onClick={() => fileRef.current?.click()} disabled={!!busy}
        >
          {busy === 'import' ? 'Restoring…' : 'Import backup'}
        </Button>
      </div>

      <input
        ref={fileRef} type="file" accept="application/json,.json"
        onChange={handlePick} style={{ display: 'none' }}
      />

      {pending && (
        <div style={S.confirm}>
          <div style={S.confirmHead}>
            <AlertTriangle size={16} color="#F59E0B" />
            <span>Replace all current data with this backup?</span>
          </div>
          <div style={S.confirmSub}>
            This overwrites every workout, food log, and setting on this device. It can’t be undone.
          </div>
          <div style={S.row}>
            <Button variant="ghost" fullWidth onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={confirmImport}>Replace &amp; restore</Button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ ...S.msg, color: msg.kind === 'err' ? '#F87171' : ac }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// Loader2 doesn't animate by itself — wrap it so the busy state actually spins.
function Spinner(props) {
  return <Loader2 {...props} className="ui-spin" />;
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  head: { display: 'flex', alignItems: 'center', gap: 8 },
  headText: { fontSize: 12.5, color: 'var(--ui-text2)', lineHeight: 1.4 },
  row: { display: 'flex', gap: 10 },
  confirm: {
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  },
  confirmHead: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--ui-text)' },
  confirmSub: { fontSize: 12.5, color: 'var(--ui-text2)', lineHeight: 1.45 },
  msg: { fontSize: 13, fontWeight: 500, lineHeight: 1.4 },
};
