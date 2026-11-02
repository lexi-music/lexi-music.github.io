(() => {
  'use strict';
  if (window.__lexiIosBackgroundStallRecovery) return;
  window.__lexiIosBackgroundStallRecovery = true;

  document.documentElement.dataset.appVersion = 'v1.05';
  const versionLabel = document.getElementById('appVersion');
  if (versionLabel) { versionLabel.dataset.version = 'v1.05'; versionLabel.textContent = 'v1.05'; }

  const audio = window.LexiMusicAudio || document.getElementById('audio');
  const storage = window.LexiAudioStorage;
  if (!audio || !storage) return;

  let recoveryTimer = null;
  let recoveryToken = 0;
  let activeFallbackUrl = null;

  function trace(stage) { window.LexiMusicDiagnostics?.record(stage); }

  function offlineIdFromSource() {
    try {
      const url = new URL(audio.currentSrc || audio.src, location.href);
      const marker = '/__offline_audio/';
      const at = url.pathname.indexOf(marker);
      return at < 0 ? null : decodeURIComponent(url.pathname.slice(at + marker.length));
    } catch { return null; }
  }

  function audioBlob(value) {
    if (value?.__musicBytes instanceof ArrayBuffer) return new Blob([value.__musicBytes], { type: value.type || 'application/octet-stream' });
    if (value instanceof Blob) return value;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return new Blob([value]);
    return null;
  }

  function cancelRecovery() {
    recoveryToken += 1;
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  async function recover(token, expectedId) {
    recoveryTimer = null;
    if (token !== recoveryToken || !document.hidden || audio.paused || audio.currentTime > 0.05) return;
    if (offlineIdFromSource() !== expectedId) return;
    try {
      await storage.ready;
      const row = await storage.get(expectedId);
      if (token !== recoveryToken || offlineIdFromSource() !== expectedId || !document.hidden || audio.paused || audio.currentTime > 0.05) return;
      const blob = audioBlob(row?.blob);
      if (!blob?.size) { trace('ios-background-stall-recovery-no-blob'); return; }
      const fallbackUrl = URL.createObjectURL(blob);
      const oldFallbackUrl = activeFallbackUrl;
      activeFallbackUrl = fallbackUrl;
      trace('ios-background-stall-recovery');
      audio.src = fallbackUrl;
      const play = audio.play();
      if (play?.catch) play.catch(error => trace('ios-background-stall-recovery-failed:' + (error?.name || 'Error')));
      if (oldFallbackUrl && oldFallbackUrl !== fallbackUrl) URL.revokeObjectURL(oldFallbackUrl);
    } catch (error) {
      trace('ios-background-stall-recovery-failed:' + (error?.name || 'Error'));
    }
  }

  function scheduleRecovery() {
    const id = offlineIdFromSource();
    if (!id || !document.hidden || audio.paused || audio.currentTime > 0.05) return;
    if (recoveryTimer) return;
    const token = ++recoveryToken;
    trace('ios-background-stall-recovery-armed');
    recoveryTimer = setTimeout(() => recover(token, id), 650);
  }

  audio.addEventListener('stalled', scheduleRecovery);
  audio.addEventListener('waiting', scheduleRecovery);
  audio.addEventListener('loadedmetadata', scheduleRecovery);
  audio.addEventListener('playing', () => {
    if (audio.currentTime > 0.05) cancelRecovery();
    else scheduleRecovery();
  });
  audio.addEventListener('timeupdate', () => { if (audio.currentTime > 0.05) cancelRecovery(); });
  audio.addEventListener('emptied', () => {
    cancelRecovery();
    if (activeFallbackUrl && !String(audio.src || '').startsWith('blob:')) {
      URL.revokeObjectURL(activeFallbackUrl);
      activeFallbackUrl = null;
    }
  });

  // The module can arrive after iOS has already emitted waiting/stalled while
  // the PWA is hidden. Arm recovery from the current native state as well.
  trace('ios-background-stall-recovery-ready');
  scheduleRecovery();
})();
