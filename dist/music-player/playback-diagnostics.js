(() => {
  'use strict';
  // Passive diagnostics only: never call audio.play(), pause(), or change src.
  // Keep the existing storage key so earlier evidence survives upgrades.
  const KEY = 'lexiMusicPlaybackDiagnosticsV1';
  const MAX_EVENTS = 1600;
  const PROGRESS_INTERVAL_MS = 45000;
  const SAFE_CONTEXT = new Set([
    'generation', 'queueIndex', 'targetIndex', 'queueSize', 'repeat',
    'shuffle', 'loading', 'confirmed', 'wants', 'pending',
    'prefetched', 'prefetchReady', 'auto', 'direction', 'targetOffline',
    'hiddenForSec', 'playheadDelta', 'wasPlaying'
  ]);
  let records = [];
  try {
    const prior = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(prior)) records = prior.slice(-MAX_EVENTS);
  } catch {}
  const audio = window.LexiMusicAudio || document.getElementById('audio');
  const rounded = number => Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
  function snapshot(stage, details = {}) {
    const entry = {
      at: new Date().toISOString(), stage,
      visible: document.visibilityState,
      online: navigator.onLine,
      mediaState: navigator.mediaSession?.playbackState || '',
      audioSessionState: navigator.audioSession?.state || '',
      standalone: navigator.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches
    };
    if (audio) {
      const src = audio.currentSrc || audio.src || '';
      Object.assign(entry, {
        time: rounded(audio.currentTime || 0),
        duration: rounded(audio.duration),
        paused: !!audio.paused,
        ended: !!audio.ended,
        muted: !!audio.muted,
        ready: audio.readyState,
        network: audio.networkState,
        sourceKind: src.startsWith('blob:') ? 'blob' :
          src.includes('/__offline_audio/') ? 'local-media-url' : 'other',
        error: audio.error?.code || 0
      });
      try {
        if (audio.buffered?.length) entry.bufferedTo = rounded(audio.buffered.end(audio.buffered.length - 1));
      } catch {}
    }
    // Never export track names, file IDs, URLs, OAuth data, or arbitrary exceptions.
    for (const [key, value] of Object.entries(details || {})) {
      if (!SAFE_CONTEXT.has(key)) continue;
      if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
          (key === 'repeat' && ['off', 'all', 'one'].includes(value))) entry[key] = value;
    }
    records.push(entry);
    if (records.length > MAX_EVENTS) records = records.slice(-MAX_EVENTS);
    try { localStorage.setItem(KEY, JSON.stringify(records)); } catch {}
    return entry;
  }
  function summarize() {
    const start = records.findLastIndex ? records.findLastIndex(e => e.stage === 'test:start')
      : records.map(e => e.stage).lastIndexOf('test:start');
    const run = start >= 0 ? records.slice(start) : [];
    return {
      startedAt: run[0]?.at || null,
      result: run.some(e => e.stage === 'test:stopped') ? 'stopped' :
        run.some(e => e.stage === 'test:worked') ? 'worked' : run.length ? 'incomplete' : 'no-test',
      automaticTransitions: run.filter(e => e.stage === 'transition-requested' && e.auto === true).length,
      preEndHandoffs: run.filter(e => e.stage === 'background-continuous-handoff').length,
      playbackStartsConfirmed: run.filter(e => e.stage === 'play-resolved' || e.stage === 'resume-confirmed').length,
      playbackFailures: run.filter(e => e.stage.startsWith('play-failed:') || e.stage === 'playback-deadline' || e.stage === 'resume-failed').length,
      naturalEnds: run.filter(e => e.stage === 'audio:ended').length,
      backgroundReturns: run.filter(e => e.stage === 'background-return').length
    };
  }
  window.LexiMusicDiagnostics = Object.freeze({ record: snapshot });
  for (const name of ['play', 'playing', 'pause', 'ended', 'waiting', 'stalled',
    'suspend', 'abort', 'canplay', 'error', 'emptied', 'loadedmetadata', 'seeking', 'seeked']) {
    audio?.addEventListener(name, () => snapshot('audio:' + name));
  }
  let lastProgress = 0;
  audio?.addEventListener('timeupdate', () => {
    if (Date.now() - lastProgress >= PROGRESS_INTERVAL_MS) {
      lastProgress = Date.now();
      snapshot('audio:progress');
    }
  });
  let hiddenBaseline = null;
  document.addEventListener('visibilitychange', () => {
    snapshot('visibility');
    if (document.hidden) {
      hiddenBaseline = { at: Date.now(), time: audio?.currentTime || 0, wasPlaying: !!audio && !audio.paused && !audio.ended };
    } else if (hiddenBaseline) {
      snapshot('background-return', {
        hiddenForSec: rounded((Date.now() - hiddenBaseline.at) / 1000),
        playheadDelta: rounded((audio?.currentTime || 0) - hiddenBaseline.time),
        wasPlaying: hiddenBaseline.wasPlaying
      });
      hiddenBaseline = null;
    }
  });
  window.addEventListener('pagehide', () => snapshot('pagehide'));
  window.addEventListener('pageshow', () => snapshot('pageshow'));
  async function share() {
    const file = new File([JSON.stringify({
      build: 'diagnostic-v2', appVersion: document.documentElement.dataset.appVersion,
      origin: location.origin, userAgent: navigator.userAgent,
      summary: summarize(), events: records
    }, null, 2)], 'lexi-music-playback-log.json', { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function addButtons() {
    const dialog = document.getElementById('settingsDialog');
    if (!dialog || document.getElementById('sharePlaybackLog')) return;
    const actions = [
      ['startPlaybackTest', 'Start locked-iPhone test', () => {
        snapshot('test:start');
        dialog.close?.();
      }],
      ['stoppedPlaybackTest', 'Playback stopped · share log', () => {
        snapshot('test:stopped');
        return share();
      }],
      ['workedPlaybackTest', 'Playback worked · share log', () => {
        snapshot('test:worked');
        return share();
      }],
      ['sharePlaybackLog', 'Share playback log', share]
    ];
    for (const [id, label, click] of actions) {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'button secondary';
      button.textContent = label;
      button.addEventListener('click', click);
      dialog.append(button);
    }
  }
  document.getElementById('settingsBtn')?.addEventListener('click', () => setTimeout(addButtons, 0));
  snapshot('diagnostics-ready');
})();
