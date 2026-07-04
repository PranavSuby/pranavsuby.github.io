// Small cross-app alert helpers: haptics, a synthesized beep, and best-effort
// notifications. All are no-ops where unsupported, so callers never need to guard.

export function vibrate(pattern = [180, 80, 180]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

let audioCtx = null;

// iOS/Safari (and Chrome's autoplay policy) only let WebAudio make sound if the
// AudioContext was created/resumed during a user gesture. The rest-timer chime fires
// later from a background interval, so without priming it stays silent and the alarm
// effectively "never fires". Call this from a tap (start workout / check off a set) so
// the context is already running when the timer ends.
export function primeAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

// A short two-note chime via WebAudio — no asset to bundle or fail to load.
export function beep({ freq = 880, duration = 0.18, gain = 0.13 } = {}) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [freq, freq * 1.5].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = now + i * duration;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(start); osc.stop(start + duration);
    });
  } catch {}
}

export function canNotify() {
  return typeof Notification !== 'undefined';
}

export async function ensureNotifyPermission() {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

// Fire a notification only if already permitted (call ensureNotifyPermission first
// from a user gesture if you want to prompt). Prefers the service worker's
// showNotification — that path keeps the notification alive when the page is
// backgrounded or frozen, where `new Notification()` is unreliable (and unsupported
// in iOS standalone PWAs). Falls back to the page-level Notification otherwise.
export function notify(title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return false;
  const opts = {
    body,
    silent: false,
    requireInteraction: true,
    vibrate: [300, 120, 300, 120, 300],
    tag: 'rest-timer',
    renotify: true,
  };
  const pageNotify = () => { try { new Notification(title, opts); } catch {} };
  try {
    // NOTE: don't use navigator.serviceWorker.ready here — it's a promise that stays
    // pending forever when registration failed (private mode, dev), which would make
    // the fallback unreachable and swallow the notification entirely.
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration()
        .then(reg => {
          if (reg) return reg.showNotification(title, opts).catch(pageNotify);
          pageNotify();
        })
        .catch(pageNotify);
      return true;
    }
    new Notification(title, opts);
    return true;
  } catch {}
  return false;
}

function postToSW(msg) {
  try {
    navigator.serviceWorker?.getRegistration().then(reg => {
      (reg?.active || navigator.serviceWorker.controller)?.postMessage(msg);
    }).catch(() => {});
  } catch {}
}

// Hand a rest countdown to the service worker so it can fire the system notification at
// `endsAt` even while the page is frozen in the background (iOS). No-op without permission.
export function scheduleRestNotification(endsAt, title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  postToSW({ type: 'schedule-rest', endsAt, title, body });
}

export function cancelRestNotification() {
  postToSW({ type: 'cancel-rest' });
}

// The standard "timer finished" combo: a longer, more insistent buzz + chime, plus a
// notification when the app is backgrounded (where the user can't see the screen).
export function alertTimerDone(title, body) {
  vibrate([400, 150, 400, 150, 400]);
  beep();
  beep({ freq: 660 });
  if (document.hidden) notify(title, body);
}
