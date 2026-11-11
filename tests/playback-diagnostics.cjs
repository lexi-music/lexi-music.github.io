const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('dist/music-player/playback-diagnostics.js', 'utf8');
const storage = new Map([['lexiMusicPlaybackDiagnosticsV1',
  JSON.stringify([{at:'2026-01-01T00:00:00Z',stage:'prior-release-evidence'}])]]);
const audioListeners = new Map(), documentListeners = new Map(), windowListeners = new Map();
const buttons = new Map();
let now = Date.UTC(2026,10,11,0,0,0), exports = [], closes = 0;
class FakeDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
class FakeFile {
  constructor(chunks, name, opts) { this.content = chunks.join(''); this.name = name; this.type = opts.type; }
}
const register = (map, name, fn) => {
  if (!map.has(name)) map.set(name, []);
  map.get(name).push(fn);
};
const emit = (map,name) => (map.get(name)||[]).forEach(fn=>fn());
const audio = {
  src: 'blob:existing', currentSrc: 'blob:existing', currentTime: 1,
  duration: 110.5, paused: false, ended: false, muted: false,
  readyState: 4, networkState: 1, error: null,
  buffered: {length:1,end:()=>20},
  addEventListener: (type,fn)=>register(audioListeners,type,fn),
  play: ()=>{throw Error('Diagnostics must never call native play');},
  pause: ()=>{throw Error('Diagnostics must never pause');}
};
const settings = {addEventListener:(type,fn)=>register(buttons,'settings:'+type,fn)};
const dialog = {append(button){buttons.set(button.id,button);},close(){closes++}};
const context = vm.createContext({
  Date: FakeDate, File: FakeFile, JSON, URL, setTimeout: fn=>{fn();return 1;},
  localStorage: {
    getItem:key=>storage.get(key)||null,
    setItem:(key,value)=>{assert.equal(key,'lexiMusicPlaybackDiagnosticsV1');storage.set(key,value);}
  },
  location: {origin:'https://lexi-music.github.io'},
  navigator: {
    onLine:true, userAgent:'fixture-iPhone', mediaSession:{playbackState:'playing'},
    canShare:()=>true, share: async ({files}) => {exports.push(JSON.parse(files[0].content));}
  },
  document: {
    hidden:false, visibilityState:'visible',
    documentElement:{dataset:{appVersion:'v1.09'}},
    getElementById:id=>({audio,settingsBtn:settings,settingsDialog:dialog}[id]||buttons.get(id)||null),
    addEventListener:(type,fn)=>register(documentListeners,type,fn),
    createElement:()=>({
      addEventListener(type,fn){this['on'+type]=fn;},
      click(){return this.onclick?.();}
    })
  },
  window:{
    matchMedia:()=>({matches:true}),
    addEventListener:(type,fn)=>register(windowListeners,type,fn)
  }
});
vm.runInContext(source,context);
const diagnostics=context.window.LexiMusicDiagnostics;
assert(diagnostics?.record,'Diagnostics API must be available to player');
assert.equal(JSON.parse(storage.get('lexiMusicPlaybackDiagnosticsV1'))[0].stage,'prior-release-evidence');
const events=()=>JSON.parse(storage.get('lexiMusicPlaybackDiagnosticsV1'));
diagnostics.record('transition-requested',{
  generation:7,queueIndex:1,targetIndex:2,queueSize:3,auto:true,direction:1,
  prefetched:true,prefetchReady:true,repeat:'all',targetOffline:true,
  trackId:'PRIVATE_TRACK_ID',title:'PRIVATE_SONG_TITLE',token:'PRIVATE_TOKEN'
});
const transition=events().at(-1);
assert.equal(transition.generation,7);
assert.equal(transition.auto,true);
assert.equal(transition.targetIndex,2);
for(const forbidden of ['trackId','title','token']) assert.equal(forbidden in transition,false);
assert.equal(transition.sourceKind,'blob');
now+=46000;audio.currentTime=47;emit(audioListeners,'timeupdate');
now+=10000;audio.currentTime=57;emit(audioListeners,'timeupdate');
assert.equal(events().filter(e=>e.stage==='audio:progress').length,1,'Only sparse progress should be persisted');
now+=47000;audio.currentTime=104;emit(audioListeners,'timeupdate');
assert.equal(events().filter(e=>e.stage==='audio:progress').length,2);
emit(buttons,'settings:click');
assert(buttons.has('startPlaybackTest')&&buttons.has('stoppedPlaybackTest')&&buttons.has('workedPlaybackTest')&&buttons.has('sharePlaybackLog'));
assert.equal(buttons.get('startPlaybackTest').type,'button','Settings form must never submit');
(async () => {
  await buttons.get('startPlaybackTest').click();
  assert.equal(closes,1);
  assert.equal(events().at(-1).stage,'test:start');
  context.document.hidden=true;context.document.visibilityState='hidden';
  emit(documentListeners,'visibilitychange');
  now+=60000;audio.currentTime=105.5;audio.paused=true;audio.ended=true;
  emit(audioListeners,'ended');
  context.document.hidden=false;context.document.visibilityState='visible';
  emit(documentListeners,'visibilitychange');
  const returned=events().at(-1);
  assert.equal(returned.stage,'background-return');
  assert.equal(returned.hiddenForSec,60);
  assert.equal(returned.playheadDelta,1.5);
  assert.equal(returned.wasPlaying,true);
  diagnostics.record('background-continuous-handoff');
  diagnostics.record('play-failed:NotAllowedError');
  await buttons.get('stoppedPlaybackTest').click();
  assert.equal(exports.length,1);
  assert.equal(exports[0].build,'diagnostic-v2');
  assert.equal(exports[0].appVersion,'v1.09');
  assert.equal(exports[0].summary.result,'stopped');
  assert.equal(exports[0].summary.playbackFailures,1);
  assert.equal(exports[0].summary.naturalEnds,1);
  assert.equal(exports[0].summary.preEndHandoffs,1);
  assert.equal(exports[0].summary.backgroundReturns,1);
  assert.equal(exports[0].summary.automaticTransitions,0);
  assert(exports[0].events.some(e=>e.stage==='prior-release-evidence'),'Existing log history must survive');
  assert(!JSON.stringify(exports[0]).includes('PRIVATE_'),'No file identifiers or secrets exported');
  await buttons.get('startPlaybackTest').click();
  diagnostics.record('transition-requested',{auto:true,direction:1});
  diagnostics.record('play-resolved');
  await buttons.get('workedPlaybackTest').click();
  assert.equal(exports[1].summary.result,'worked');
  assert.equal(exports[1].summary.automaticTransitions,1);
  assert.equal(exports[1].summary.playbackStartsConfirmed,1);
  assert.equal(exports[1].summary.playbackFailures,0,'Only the most recent test is summarized');
  emit(windowListeners,'pagehide');
  assert.equal(events().at(-1).stage,'pagehide');
  console.log('PASS: passive event-only diagnostics, privacy, sparse long-running logging, hidden-return observation, old history, manual locked-iPhone test markers and share summary');
})().catch(error=>{console.error(error);process.exitCode=1});
