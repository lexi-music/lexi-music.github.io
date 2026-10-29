const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(process.argv[2] || 'dist/music-player/app-player.js', 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ nativeClock = false } = {}) {
  const timers = new Map(); let timerId = 0;
  const listeners = new Map();
  const actions = {}, requests = [], prepared = [], nodes = new Map(), storage = new Map();
  const audio = {
    src: 'A.mp3', readyState: 4, error: null, paused: true, currentTime: 0,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); }
  };
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: '', classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener() {}
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    console, AbortController, DOMException, URL, Blob, Event,
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    location: { href: 'https://example.test/music-player/' },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { getElementById: id => id === 'audio' ? audio : node(id) },
    navigator: { onLine: true, mediaSession: { setActionHandler: (name, handler) => { actions[name] = handler; } } },
    MediaMetadata: class { constructor(value) { Object.assign(this, value); } },
    window: {
      matchMedia: () => ({ matches: false }), dispatchEvent() {},
      LexiAudioStorage: { ready: Promise.resolve(), get: async id => ({ id, blob: new Blob(['audio']) }) },
      LexiMusicDeck: { canActivate: () => false, activate: () => false, clear() {}, prepare: id => prepared.push(id) }
    }
  });
  // Run the actual player closure, replacing only startup with an isolated fixture.
  // Nothing is added to the shipped application or real browser storage.
  const marker = '  init().catch(error => {';
  assert(source.includes(marker));
  const hook = `
    library = ['A','B','C'].map(id => ({id, name:id}));
    currentTrackId = 'A'; queue = ['A','B','C']; shuffle = false;
    offlineIds = new Set(['A','B','C']);
    render = () => {};
    applyEmbeddedMetadata = async () => ({});
    ${nativeClock ? '' : "startNativePlayback = signal => withPlaybackDeadline(() => els.audio.play(), signal, 'Playback timed out');"}
    installMediaControls();
    window.testPlayer = {
      playTrack, resumePlayback, pausePlayback,
      source(fn) { sourceForTrack = fn; },
      prepare(id) { prefetched = {id, source:{url:id+'.mp3',offline:true,blob:new Blob(['audio'])}}; },
      warmed() { return prefetched?.id; },
      repeat(mode) { repeatMode=mode; },
      state() { return {currentTrackId, pendingTrackId, playbackLoading, wantsPlayback}; }
    };
    return;
  `;
  vm.runInContext(source.replace(marker, hook + marker), context);
  const player = context.window.testPlayer;
  player.source(async track => { requests.push(track.id); return { url: track.id + '.mp3', offline: true, blob: new Blob(['audio']) }; });
  return { player, audio, actions, requests, prepared, nodes, context,
    emit(type) { for (const fn of [...(listeners.get(type) || [])]) fn(); },
    expire(ms) { for (const [id, timer] of [...timers]) { if (timer.ms === ms) { timers.delete(id); timer.fn(); } } }
  };
}

module.exports = { harness, flush };
if (require.main === module) (async () => {
  {
    const h = harness(), read = deferred();
    h.audio.readyState = 2;
    h.player.source(track => { h.requests.push(track.id); return read.promise; });
    const skip = h.actions.nexttrack();
    const systemPlay = h.actions.play();
    assert.deepEqual(h.requests, ['B'], 'Play during a skip must not reload A');
    read.resolve({ url: 'B.mp3', offline: true, blob: new Blob(['audio']) });
    await Promise.all([skip, systemPlay]); await flush();
    assert.equal(h.player.state().currentTrackId, 'B');
    assert.equal(h.player.state().playbackLoading, false);
  }
  {
    const h = harness(), native = deferred();
    h.audio.play = () => { h.audio.paused = false; return native.promise; };
    const start = h.player.playTrack('B', true);
    await flush();
    h.actions.pause(); native.resolve(); await start;
    assert.equal(h.prepared.length, 0);
    h.audio.play = async () => { h.audio.paused = false; };
    await h.actions.play(); await flush();
    assert.equal(h.player.warmed(), 'C', 'Resume must restore next-song preparation');
    assert.equal(h.player.state().wantsPlayback, true);
  }
  {
    const h = harness();
    h.audio.play = async () => { throw Error('native resume rejected'); };
    await h.actions.play();
    assert.equal(h.player.state().wantsPlayback, false);
    assert.equal(h.player.state().playbackLoading, false);
    assert.equal(h.player.state().pendingTrackId, null);
    assert.equal(h.context.navigator.mediaSession.playbackState, 'paused');
    assert.match(h.nodes.get('statusDetail').textContent, /native resume rejected/);
  }
  for (const failure of [false, true]) {
    const h = harness(), native = deferred();
    h.audio.play = () => native.promise;
    const resume = h.actions.play();
    h.actions.pause();
    failure ? native.reject(Error('late rejection')) : native.resolve();
    await resume;
    assert.equal(h.player.state().wantsPlayback, false, 'Late resume must respect pause');
    assert.equal(h.prepared.length, 0);
  }
  {
    const h = harness(), native = deferred(), read = deferred();
    h.audio.play = () => native.promise;
    const resume = h.actions.play();
    h.player.source(() => read.promise);
    const skip = h.actions.nexttrack();
    native.reject(Error('old resume failed')); await resume;
    assert.equal(h.player.state().pendingTrackId, 'B');
    assert.equal(h.player.state().playbackLoading, true);
    assert.equal(h.player.state().wantsPlayback, true);
    h.audio.play = async () => {};
    read.resolve({ url: 'B.mp3', offline: true, blob: new Blob(['audio']) });
    await skip;
    assert.equal(h.player.state().currentTrackId, 'B');
  }
  {
    const h = harness(), native = deferred(); let calls = 0;
    h.audio.play = () => { calls++; return native.promise; };
    const resume = h.actions.play(); await h.actions.play();
    assert.equal(calls, 1, 'Repeated system Play must share the pending start');
    native.resolve(); await resume;
  }
  {
    const h = harness(), read = deferred();
    h.audio.paused = false;
    h.player.source(() => read.promise);
    const skip = h.actions.nexttrack();
    assert.equal(h.audio.paused, false, 'Reading the next song must not pause the current song');
    h.expire(12000); await skip;
    assert.equal(h.player.state().currentTrackId, 'A');
    assert.equal(h.audio.paused, false, 'A timed-out source read must retain current playback');
    assert.equal(h.player.state().playbackLoading, false);
  }
  {
    const h = harness({ nativeClock:true });
    const resume = h.actions.play(); await flush();
    assert.equal(h.player.state().playbackLoading, true, 'Resolved play without clock progress is still loading');
    h.expire(12000); await resume;
    assert.equal(h.player.state().playbackLoading, false);
    assert.equal(h.player.state().wantsPlayback, false);
    assert.equal(h.audio.paused, true);
    const retry = h.actions.play(); await flush();
    h.audio.currentTime += 1; h.emit('timeupdate'); await retry;
    assert.equal(h.player.state().wantsPlayback, true, 'Play must work again after a stalled start');
  }
  {
    const h = harness({ nativeClock:true });
    h.audio.play = () => new Promise(() => {});
    const resume = h.actions.play(); h.expire(12000); await resume;
    assert.equal(h.player.state().playbackLoading, false, 'An unresolved native play must not lock controls');
    assert.equal(h.audio.paused, true);
  }
  {
    const h = harness({ nativeClock:true });
    const resume = h.actions.play(); await flush();
    h.audio.currentTime = 1; h.expire(12000); await resume;
    assert.equal(h.player.state().wantsPlayback, true, 'Delayed background progress events must not cause a false timeout');
  }
  {
    const h = harness({ nativeClock:true }), read = deferred();
    const resume = h.actions.play(); await flush();
    h.player.source(() => read.promise);
    const skip = h.actions.nexttrack(); await resume;
    assert.equal(h.audio.paused, true, 'A superseded native handoff must be cancelled before another source read');
    h.actions.pause(); await skip;
    assert.equal(h.player.state().wantsPlayback, false);
  }
  // src replacement can expose the previous resource's official position
  // until the browser processes the new load. Do not use it as the new baseline.
  for (const prepared of [false, true]) {
    for (const progressEvent of [false, true]) {
      const h = harness({ nativeClock:true });
      h.audio.currentTime = 180; h.audio.paused = false;
      if (prepared) h.player.prepare('B');
      const skip = h.actions.nexttrack(); await flush();
      h.audio.currentTime = .5;
      if (progressEvent) h.emit('timeupdate');
      h.expire(12000); await flush();
      assert.equal(h.player.state().currentTrackId, 'B', 'A playing replacement must not be skipped by a false deadline');
      await skip;
      assert.equal(h.audio.paused, false, 'A new song must not time out against the old song clock');
      assert.equal(h.player.state().wantsPlayback, true);
      assert.equal(h.player.state().playbackLoading, false);
    }
  }
  {
    const h = harness({ nativeClock:true });
    h.audio.currentTime = 180;
    const resume = h.actions.play(); await flush();
    h.expire(12000); await resume;
    assert.equal(h.audio.paused, true, 'A stalled resume must still require progress past its saved position');
  }
  console.log('PASS: pending skip + Play, pause/start/resume prefetch, failed resume, late resolution/rejection after pause/skip, repeated Play, retained current song, source deadline, native clock stall/deadline/retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
