const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const timers = new Map(), events = []; let sequence = 0;
  function element(id) {
    const listeners = new Map();
    return {
      id, src: id === 'audio' ? 'A.mp3' : '', readyState: 4, error: null,
      currentTime: 0, ended: false, paused: id !== 'audio', muted: false,
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      emit(type) { for (const fn of [...(listeners.get(type) || [])]) fn.call(this, {type}); },
      setAttribute() {}, removeAttribute(name) { if (name === 'src') this.src = ''; }, load() {},
      play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; this.emit('pause'); }
    };
  }
  const old = element('audio'), next = element('spare');
  const context = {
    console, DOMException, navigator: {standalone:true},
    document: {getElementById: () => old, createElement: () => next, body:{append(){}}},
    window: {LexiMusicDiagnostics: {record: stage => events.push(stage)}},
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, {fn,ms}); return id; },
    clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(fs.readFileSync('dist/music-player/audio-deck.js', 'utf8'), context);
  const deck = context.window.LexiMusicDeck, audio = context.window.LexiMusicAudio;
  deck.prepare('B', 'B.mp3'); assert.equal(deck.activate('B', 'B.mp3'), true);
  return {old,next,deck,audio,events,expire(){for (const [id,t] of [...timers]) {timers.delete(id);t.fn();}}};
}
(async () => {
  {
    const h = harness(), outcome = h.audio.play().catch(error => error);
    await flush(); h.expire(); const error = await outcome;
    assert.equal(error.retainedSource, true);
    assert.equal(h.old.paused, false, 'Failed handoff must keep the original song playing');
    assert.equal(h.old.src, 'A.mp3'); assert.equal(h.next.paused, true);
    assert.equal(h.audio.src, 'A.mp3', 'Audio handle must follow the rollback');
    assert(h.events.includes('handoff-rolled-back'));
    // A failed handoff must not poison the next attempt.
    h.deck.prepare('B', 'B.mp3'); assert(h.deck.activate('B', 'B.mp3'));
    const retry = h.audio.play(); h.next.currentTime = 1; h.next.emit('timeupdate'); await retry;
    assert.equal(h.audio.src, 'B.mp3'); assert.equal(h.old.paused, true);
  }
  {
    const h = harness(), outcome = h.audio.play();
    await flush(); h.next.currentTime = 1; h.expire(); await outcome;
    assert.equal(h.next.paused, false, 'A progressing clock must survive delayed background events');
    assert.equal(h.old.paused, true); assert.equal(h.old.src, '');
  }
  {
    const h = harness(), outcome = h.audio.play().catch(error => error);
    h.audio.pause(); assert.equal((await outcome).name, 'AbortError');
    assert.equal(h.old.paused, true); assert.equal(h.next.paused, true);
    assert.equal(h.audio.src, 'B.mp3', 'Explicit pause must retain the requested song');
  }
  {
    const h = harness(); h.next.play = () => Promise.reject(new Error('native start rejected'));
    const error = await h.audio.play().catch(error => error);
    assert.equal(error.retainedSource, true); assert.equal(h.old.paused, false);
  }
  {
    const h = harness(); h.old.ended = true; h.old.paused = true;
    const outcome = h.audio.play().catch(error => error); h.expire(); const error = await outcome;
    assert(!error.retainedSource, 'Do not roll back to an already-ended song');
    assert.equal(h.audio.src, 'B.mp3'); assert.equal(h.next.paused, true);
  }
  console.log('PASS: real two-player handoff rollback/retry, native rejection, explicit pause, ended source, delayed background events');
})().catch(error => {console.error(error);process.exitCode=1});
