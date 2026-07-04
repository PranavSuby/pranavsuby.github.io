import { useEffect, useRef } from 'react';

// Hold a Screen Wake Lock while `active` is true (e.g. during a live workout) so the
// phone doesn't dim/sleep. Re-acquires automatically when the tab returns to the
// foreground, since the OS releases the lock whenever the page is hidden.
export default function useWakeLock(active) {
  const lockRef = useRef(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    async function acquire() {
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
      } catch { /* denied / not visible — ignore */ }
    }

    function onVisible() {
      if (!cancelled && document.visibilityState === 'visible') acquire();
    }

    acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      try { lockRef.current?.release(); } catch {}
      lockRef.current = null;
    };
  }, [active]);
}
