import { useRef } from 'react';

// Drag-to-dismiss for bottom sheets. Attach `panelRef` to the sheet panel.
// Two ways to start a drag:
//   • spread `handleProps` onto the grabber handle — grabbing it drags immediately.
//   • spread `zoneProps` onto the panel — a downward swipe that STARTS in the top
//     `topZone` fraction (default 30%) of the panel also drags it down to close.
// The zone drag is gated on clear downward intent, so taps/focus on header controls
// and scrolling the inner list still work normally. Pointer events cover touch + mouse.
export default function useDragToClose(onClose, { threshold = 90, topZone = 0.20 } = {}) {
  const panelRef = useRef(null);
  const drag = useRef(null);

  function finishOpenOrClose() {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel || !d.active) return;
    panel.style.transition = 'transform 0.25s ease';
    if (d.dy > threshold || d.v > 0.6) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => {
        panel.style.transform = '';
        panel.style.transition = '';
        onClose?.();
      }, 200);
    } else {
      panel.style.transform = 'translateY(0)';
    }
  }

  // Grabber handle — drag begins instantly.
  function gripDown(e) {
    const panel = panelRef.current;
    if (!panel) return;
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: Date.now(), dy: 0, v: 0, active: true };
    panel.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  // Drag zone — arm a potential drag; it only activates on downward movement.
  // Spread on the PANEL → only the top `topZone` fraction is the zone (keeps it off the
  // scroll area). Spread on a dedicated non-scrolling HEADER element → the whole header is
  // the zone, so the swipe area sits entirely above any scrolling window.
  function zoneDown(e) {
    if (drag.current) return; // grip already handling this gesture
    const panel = panelRef.current;
    if (!panel) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const limit = el === panel ? rect.top + rect.height * topZone : rect.bottom;
    if (e.clientY > limit) return; // below the drag zone
    drag.current = {
      startY: e.clientY, lastY: e.clientY, lastT: Date.now(), dy: 0, v: 0,
      active: false, armed: true, pointerId: e.pointerId,
    };
  }

  function onMove(e) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    if (d.lastEvent === e) return; // same event bubbling through grip + panel — handle once
    d.lastEvent = e;
    if (d.armed && !d.active) {
      const raw = e.clientY - d.startY;
      if (raw < 6) {                    // not yet a clear downward drag
        if (raw < -6) drag.current = null; // moved up → release the arm (let it scroll/tap)
        return;
      }
      d.active = true;                  // downward intent → take over the gesture
      panel.style.transition = 'none';
      e.currentTarget.setPointerCapture?.(d.pointerId);
    }
    if (!d.active) return;
    e.preventDefault?.();
    const dy = Math.max(0, e.clientY - d.startY);
    const now = Date.now();
    const dt = now - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt; // px/ms
    d.lastY = e.clientY;
    d.lastT = now;
    d.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
  }

  const handleProps = {
    onPointerDown: gripDown,
    onPointerMove: onMove,
    onPointerUp: finishOpenOrClose,
    onPointerCancel: finishOpenOrClose,
    style: { touchAction: 'none', cursor: 'grab' },
  };

  const zoneProps = {
    onPointerDown: zoneDown,
    onPointerMove: onMove,
    onPointerUp: finishOpenOrClose,
    onPointerCancel: finishOpenOrClose,
  };

  return { panelRef, handleProps, zoneProps };
}
