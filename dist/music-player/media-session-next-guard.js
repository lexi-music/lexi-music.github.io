(() => {
  'use strict';
  if (window.__lexiMediaSessionNextGuard) return;
  window.__lexiMediaSessionNextGuard = true;

  const session = navigator.mediaSession;
  if (!session?.setActionHandler) return;

  const nativeSetActionHandler = session.setActionHandler.bind(session);
  let lastNextAt = -Infinity;
  const BURST_WINDOW_MS = 250;

  session.setActionHandler = (action, handler) => {
    if (action !== 'nexttrack' || typeof handler !== 'function') {
      return nativeSetActionHandler(action, handler);
    }
    const guarded = event => {
      const now = performance.now();
      if (now - lastNextAt < BURST_WINDOW_MS) {
        window.LexiMusicDiagnostics?.record('lockscreen-next-duplicate-ignored');
        return;
      }
      lastNextAt = now;
      handler(event);
    };
    return nativeSetActionHandler(action, guarded);
  };
})();
