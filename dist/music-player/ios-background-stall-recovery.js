/* Legacy compatibility entry. Playback recovery is owned exclusively by app-player.js.
 * Do not change audio.src or invoke play() here: doing so interrupts pending
 * native starts and can cascade AbortError failures during background handoff.
 */
(() => {
  'use strict';
  if (window.__lexiIosBackgroundStallRecovery) return;
  window.__lexiIosBackgroundStallRecovery = true;
  window.LexiMusicDiagnostics?.record('ios-background-recovery-delegated-to-player');
})();
