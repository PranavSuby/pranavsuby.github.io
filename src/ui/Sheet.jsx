import useDragToClose from './useDragToClose';
import useBackClose from './navStack';

export default function Sheet({ open, onClose, title, tall = false, flex = false, keepMounted = false, children }) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);

  // Browser/gesture Back closes the sheet (while open) instead of leaving the app.
  // Escape is handled centrally by navStack (top layer only), so no listener here.
  useBackClose(onClose, open);

  if (!open && !keepMounted) return null;

  const sheetCls = ['ui-sheet', tall && 'ui-sheet--tall', flex && 'ui-sheet--flex']
    .filter(Boolean).join(' ');

  return (
    <div
      className="ui-sheet-overlay"
      style={!open ? { display: 'none' } : undefined}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={sheetCls}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Sheet'}
        {...zoneProps}
      >
        <div className="ui-sheet-handle" {...handleProps} />
        {title && <div className="ui-sheet-title" {...handleProps}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
