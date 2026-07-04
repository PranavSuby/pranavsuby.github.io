import { useContext, useEffect, useRef } from 'react';
import { KeepAliveActiveContext } from './KeepAlive';

// ─── In-app navigation stack (the app's single owner of the browser Back button) ───
//
// Architecture — two cleanly separated layers, each with ONE owner:
//   • React Router (src/App.jsx) owns only the three real pages: "/", "/gym-app",
//     "/nutricore". It never sees in-app navigation.
//   • This NavStack owns ALL in-app layered navigation: tab sub-views, overlays, modals,
//     and sheets in both the gym app and NutriCore. Components never touch
//     `window.history` directly — they declare "I'm a layer, close me on Back" via the
//     `useBackClose` hook below.
//
// These apps are app-like mobile PWAs (tab bar + deep modal stacks), not page/content
// apps, so screens are intentionally NOT URL-addressable. To make the hardware/gesture
// Back button close one layer at a time instead of leaving the app, we keep a single
// "sentinel" history entry alive whenever any layer is open and route Back (popstate) to
// the top-most layer's close handler (LIFO). Nested overlays and in-modal step wizards
// compose naturally because we re-trap Back as long as any layer remains.
//
// Router-safety: the sentinel is pushed as `pushState(window.history.state, '')`, i.e. it
// duplicates React Router's CURRENT history state (its `key`/`idx`) onto the trap entry.
// On pop, React Router sees the same location AND the same state shape, so it treats it as
// a no-op rather than desyncing its internal index. This is the fix for the original bug,
// where a raw `pushState({...})` clobbered React Router's state.

let handlers = [];          // stack of close callbacks; last = deepest/top overlay
let hasSentinel = false;    // is our dummy history entry currently present?
let teardownTimer = null;   // debounces sentinel removal across sibling view swaps

function ensureSentinel() {
  if (hasSentinel) return;
  hasSentinel = true;
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onEsc);
  // Preserve React Router's state so the trap entry doesn't corrupt its history tracking.
  // The __navSentinel stamp lets teardown verify the sentinel is still the top entry.
  window.history.pushState({ ...(window.history.state || {}), __navSentinel: true }, '');
}

function removeSentinel() {
  if (!hasSentinel) return;
  hasSentinel = false;
  window.removeEventListener('popstate', onPop);
  document.removeEventListener('keydown', onEsc);
  // Only consume the entry if it's still ours. If the router pushed a route on top
  // (e.g. the user navigated to another app while a layer was open), calling back()
  // here would pop the page they just navigated to.
  if (window.history.state?.__navSentinel) {
    window.history.back();   // consume the entry we added (same URL → no visible change)
  }
}

// Escape mirrors Back on desktop: close ONE layer (the top-most), not all of them.
function onEsc(e) {
  if (e.key !== 'Escape') return;
  const close = handlers[handlers.length - 1];
  if (close) close();
}

function onPop() {
  // The browser already popped our sentinel.
  hasSentinel = false;
  window.removeEventListener('popstate', onPop);
  document.removeEventListener('keydown', onEsc);
  const close = handlers[handlers.length - 1];
  if (close) close();
  // If overlays remain open after this close settles, re-trap Back for them.
  setTimeout(() => { if (handlers.length > 0) ensureSentinel(); }, 0);
}

function registerBack(close) {
  if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }
  handlers.push(close);
  ensureSentinel();
}

function unregisterBack(close) {
  const i = handlers.lastIndexOf(close);
  if (i !== -1) handlers.splice(i, 1);
  if (handlers.length === 0) {
    // Defer so a sibling view swap (one unmounts, another mounts in the same commit)
    // doesn't tear down and immediately rebuild the sentinel.
    if (teardownTimer) clearTimeout(teardownTimer);
    teardownTimer = setTimeout(() => {
      teardownTimer = null;
      if (handlers.length === 0) removeSentinel();
    }, 0);
  }
}

// Close this overlay/sub-view when the user presses Back (or swipes back), instead of
// leaving the app. `active` lets always-mounted components (e.g. a Sheet toggled by an
// `open` prop) opt in only while visible. For a multi-step wizard, pass an `onClose` that
// steps backward and only truly closes on the first step — Back re-traps after a
// non-closing handler, so each press advances one step back.
export default function useBackClose(onClose, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  // Layers inside a hidden KeepAlive subtree (inactive tab) stay mounted but must not
  // hold a Back registration — otherwise Back "closes" invisible views in other tabs.
  const visible = useContext(KeepAliveActiveContext);
  const effective = active && visible;
  useEffect(() => {
    if (!effective) return undefined;
    const close = () => { if (ref.current) ref.current(); };
    registerBack(close);
    return () => unregisterBack(close);
  }, [effective]);
}
