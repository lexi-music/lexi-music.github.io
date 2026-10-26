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

function harness() {
  const actions = {}, requests = [], prepared = [], nodes = new Map(), storage = new Map();
  const audio = {
    src: 'A.mp3', readyState: 4, error: null, paused: true, currentTime: 0,
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
    console, AbortController, URL, Blob, Event, setTimeout, clearTimeout,
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
    installMediaControls();
    window.testPlayer = {
      playTrack, resumePlayback, pausePlayback,
      source(fn) { sourceForTrack = fn; },
      state() { return {currentTrackId, pendingTrackId, playbackLoading, wantsPlayback}; }
    };
    return;
  `;
  vm.runInContext(source.replace(marker, hook + marker), context);
  const player = context.window.testPlayer;
  player.source(async track => { requests.push(track.id); return { url: track.id + '.mp3', offline: true, blob: new Blob(['audio']) }; });
  return { player, audio, actions, requests, prepared, nodes, context };
}

(async () => {
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
    assert.deepEqual(h.prepared, ['C'], 'Resume must restore next-song preparation');
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
  console.log('PASS: pending skip + Play, pause/start/resume prefetch, failed resume, late resolution/rejection after pause/skip, repeated Play');
})().catch(error => { console.error(error); process.exitCode = 1; });
