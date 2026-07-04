// Inline style objects shared across all live-workout components.
export const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'var(--bg)', display: 'flex', flexDirection: 'column',
  },

  prBanner: {
    position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
    zIndex: 600, background: 'linear-gradient(135deg, #065F46, #047857)',
    color: '#6EE7B7', borderRadius: 24, padding: '8px 20px',
    fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
    whiteSpace: 'nowrap', pointerEvents: 'none',
  },

  liveHeader: {
    position: 'sticky', top: 0, zIndex: 200,
    background: 'var(--bg)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: 'calc(max(env(safe-area-inset-top, 0px), 8px) + 10px) 12px 10px',
    flexShrink: 0,
  },
  liveTitleInput: {
    flex: 1, background: 'transparent', border: 'none',
    color: 'var(--text)', fontSize: 16, fontWeight: 600,
    textAlign: 'center', outline: 'none', minWidth: 0,
  },
  finishBtn: {
    background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '8px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
  },

  statsBar: {
    display: 'flex', alignItems: 'center', padding: '10px 16px',
    borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
  },
  statCell: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  statDivider: { width: 1, height: 28, background: 'var(--border)' },

  progressTrack: { width: '100%', height: 3, background: 'var(--bg2)', flexShrink: 0 },
  progressFill: { height: '100%', background: 'var(--accent)', borderRadius: '0 2px 2px 0' },

  liveBody: {
    flex: 1, overflowY: 'auto', padding: '12px 16px 0',
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  exCard: {
    background: 'var(--bg2)', borderRadius: 14,
    border: '1px solid var(--border)', padding: '14px 14px 10px',
  },
  exCardHeader: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  exCardName: { fontSize: 16, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.3 },

  setHeaders: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr 64px 64px 40px',
    gap: 4, alignItems: 'center', marginBottom: 6,
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    color: 'var(--text3)', textAlign: 'center',
  },
  setRow: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr 64px 64px 40px',
    gap: 4, alignItems: 'center',
    minHeight: 44, borderRadius: 8, padding: '3px 0', marginBottom: 4,
  },
  prevLabel: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 0,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  setInput: {
    background: 'var(--bg3)', border: '1.5px solid var(--border2)',
    borderRadius: 8, color: 'var(--text)',
    fontSize: 16, fontWeight: 600,
    padding: '6px 4px', textAlign: 'center',
    outline: 'none', width: '100%', minWidth: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  checkBtn: {
    width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto', transition: 'background 0.15s, border-color 0.15s',
  },
  addSetBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text2)',
    fontSize: 14, fontWeight: 600, width: '100%',
    padding: '10px 0', cursor: 'pointer', marginTop: 6,
  },

  supersetWrap: {
    // NOTE: no `overflow: hidden` — it would clip each card's 3-dot dropdown menu,
    // which is the only way to un-link a superset.
    border: '2px solid var(--accent)', borderRadius: 14,
    position: 'relative', display: 'flex', flexDirection: 'column',
  },
  supersetLabel: {
    background: 'var(--accent)', color: '#E0E7FF',
    fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
    padding: '5px 14px', textAlign: 'center',
    borderRadius: '12px 12px 0 0',   // match the wrap's inner corners
  },

  exMenuDrop: {
    position: 'absolute', top: '100%', right: 0,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 12, minWidth: 210,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 300,
  },
  exMenuItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', background: 'none', border: 'none',
    padding: '11px 16px', fontSize: 14, cursor: 'pointer',
    color: 'var(--text2)', textAlign: 'left',
  },
  menuDivider: { height: 1, background: 'var(--border)', margin: '4px 0' },

  addExBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '14px 0',
    background: 'var(--accent)', border: 'none', borderRadius: 12,
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  settingsBtn: {
    flex: 1, padding: '13px 0', background: 'var(--bg2)',
    border: '1px solid var(--border)', borderRadius: 12,
    color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  discardBtn: {
    flex: 1, padding: '13px 0', background: 'var(--bg2)',
    border: '1px solid var(--border)', borderRadius: 12,
    color: 'var(--failure)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },

  restTimerWrap: {
    position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
    display: 'flex', justifyContent: 'center', zIndex: 350,
    padding: '0 16px', pointerEvents: 'none',
  },
  restTimerCard: {
    background: 'var(--bg2)', borderRadius: 16, border: '1.5px solid var(--border)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
    pointerEvents: 'all',
  },
  restAdjBtn: {
    background: 'var(--bg3)', border: 'none', borderRadius: 8,
    color: 'var(--text2)', fontSize: 12, fontWeight: 600,
    padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  restCircleWrap: {
    position: 'relative', width: 64, height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  restSecs: {
    position: 'absolute', fontSize: 15, fontWeight: 800,
    color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
  },
  restSkipBtn: {
    background: 'var(--bg3)', border: 'none', borderRadius: 8,
    color: 'var(--text2)', padding: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    background: 'var(--bg2)', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 },
  noteTextarea: {
    width: '100%', background: 'var(--bg)', border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--text)', fontSize: 16, padding: '10px 12px',
    resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 16,
  },
  restModalRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 },
  restModalAdj: {
    background: 'var(--bg3)', border: 'none', borderRadius: 8,
    color: 'var(--text2)', fontSize: 14, fontWeight: 700, padding: '8px 16px', cursor: 'pointer',
  },
  restModalDisplay: { display: 'flex', alignItems: 'baseline', minWidth: 80, justifyContent: 'center' },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  modalCancelBtn: {
    background: 'var(--bg3)', border: 'none', borderRadius: 9,
    color: 'var(--text2)', fontSize: 14, fontWeight: 600, padding: '9px 18px', cursor: 'pointer',
  },
  modalSaveBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 9,
    color: '#fff', fontSize: 14, fontWeight: 700, padding: '9px 18px', cursor: 'pointer',
  },

  wcScreen: { position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)', overflowY: 'auto' },
  wcInner: { maxWidth: 480, margin: '0 auto', padding: 'calc(env(safe-area-inset-top, 0px) + 48px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  wcTrophy: { fontSize: 64, lineHeight: 1, marginBottom: 16 },
  wcTitle: { fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 16, textAlign: 'center' },
  wcTitleInput: {
    width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--text)', fontSize: 16, fontWeight: 600,
    padding: '12px 14px', textAlign: 'center', outline: 'none', marginBottom: 24,
  },
  wcStatsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', marginBottom: 28 },
  wcStatCell: { background: 'var(--bg2)', borderRadius: 12, padding: '16px 8px', textAlign: 'center' },
  wcStatVal: { fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 },
  wcStatLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  wcSection: { width: '100%', marginBottom: 24 },
  wcSectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  wcPrRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  wcPrBadge: { background: 'var(--pr-dim)', color: 'var(--pr-green)', fontSize: 10, fontWeight: 800, borderRadius: 5, padding: '2px 7px', letterSpacing: 0.5, flexShrink: 0 },
  wcPrName: { flex: 1, fontSize: 14, color: 'var(--text2)', fontWeight: 500 },
  wcPrVal: { fontSize: 13, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' },
  wcExRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  wcExName: { fontSize: 14, color: 'var(--text2)', fontWeight: 500 },
  wcExSets: { fontSize: 13, color: 'var(--text3)' },
  saveWorkoutBtn: { width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, padding: '15px 0', cursor: 'pointer', marginBottom: 12, marginTop: 8 },
  wcBackBtn: { background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '8px 0' },

  sheetBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 500, flexDirection: 'column', justifyContent: 'flex-end',
  },
  // Auto-height panel for small sheets (set type, RIR/RPE, settings)
  sheetPanelAuto: {
    background: 'var(--bg2)', borderRadius: '20px 20px 0 0',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    maxHeight: '80vh',
  },
  sheetHandle: { width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 },

  settingsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  settingsLabel: { fontSize: 16, color: 'var(--text)' },
  settingsValue: { fontSize: 15, color: 'var(--text3)' },

  iconBtn: { background: 'none', border: 'none', padding: 6, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
