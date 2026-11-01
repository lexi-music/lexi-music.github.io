const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('dist/music-player/media-session-next-guard.js', 'utf8');
let installed = null;
let now = 1000;
const records = [];
const mediaSession = {
  setActionHandler(action, handler) {
    if (action === 'nexttrack') installed = handler;
  }
};
const context = {
  window: { LexiMusicDiagnostics: { record: stage => records.push(stage) } },
  navigator: { mediaSession },
  performance: { now: () => now }
};
context.window.window = context.window;
vm.runInNewContext(source, context);

let calls = 0;
mediaSession.setActionHandler('nexttrack', () => { calls += 1; });
assert.equal(typeof installed, 'function');
installed();
now += 3;
installed();
now += 7;
installed();
assert.equal(calls, 1, 'same-burst duplicate lock-screen Next events must be ignored');
assert.equal(records.filter(x => x === 'lockscreen-next-duplicate-ignored').length, 2);
now += 300;
installed();
assert.equal(calls, 2, 'a later deliberate Next event must still work');
console.log('lockscreen-next-guard: ok');
