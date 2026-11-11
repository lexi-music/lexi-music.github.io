const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/music-player/playback-diagnostics.js','utf8');
const storage=new Map([['lexiMusicPlaybackDiagnosticsV1',JSON.stringify([{at:'2026-01-01T00:00:00Z',stage:'prior-release-evidence'}])]]);
const audioListeners=new Map(),docListeners=new Map(),winListeners=new Map(),buttons=new Map();
let now=Date.UTC(2026,10,11),sharedLogs=[],closes=0;
const on=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn)};
const emit=(map,type)=>{for(const f of map.get(type)||[])f()};
class FakeDate extends Date {
 constructor(...args){super(...(args.length?args:[now]))}
 static now(){return now}
}
class FakeFile {
 constructor(chunks,name,options){this.content=chunks.join('');this.name=name;this.type=options.type}
}
const audio={
 src:'blob:existing',currentSrc:'blob:existing',currentTime:1,duration:110.5,
 paused:false,ended:false,muted:false,readyState:4,networkState:1,error:null,
 volume:1,playbackRate:1,
 buffered:{length:1,end:()=>20},
 addEventListener:(type,fn)=>on(audioListeners,type,fn),
 play(){throw Error('Diagnostics must never invoke play()')},
 pause(){throw Error('Diagnostics must never invoke pause()')}
};
function element(){
 return {
  children:[],style:{},
  addEventListener(type,fn){this['on'+type]=fn},
  append(...nodes){for(const node of nodes){this.children.push(node);if(node.id)buttons.set(node.id,node)}},
  click(){return this.onclick?.()}
 }
}
const form={querySelector:selector=>selector==='.dialog-actions'?{parentNode:{insertBefore(wrap){
 for(const child of wrap.children||[])if(child.id)buttons.set(child.id,child);
}}}:null};
const dialog={close(){closes++},querySelector:selector=>selector==='form'?form:null,append(wrap){
 for(const child of wrap.children||[])if(child.id)buttons.set(child.id,child);
}};
const settings={addEventListener:(type,fn)=>on(winListeners,'settings:'+type,fn)};
const context=vm.createContext({
 Date:FakeDate,File:FakeFile,JSON,URL,performance:{now:()=>0},
 setTimeout:fn=>{fn();return 1},setInterval:()=>1,
 localStorage:{
   getItem:key=>storage.get(key)||null,
   setItem:(key,value)=>{assert.equal(key,'lexiMusicPlaybackDiagnosticsV1');storage.set(key,value)}
 },
 location:{origin:'https://lexi-music.github.io'},
 navigator:{
   onLine:true,userAgent:'fixture-iPhone',mediaSession:{playbackState:'playing'},
   canShare:()=>true,share:async ({files})=>sharedLogs.push(JSON.parse(files[0].content))
 },
 document:{
   hidden:false,visibilityState:'visible',documentElement:{dataset:{appVersion:'v1.10'}},
   getElementById:id=>({audio,settingsBtn:settings,settingsDialog:dialog}[id]||buttons.get(id)||null),
   addEventListener:(type,fn)=>on(docListeners,type,fn),
   createElement:element
 },
 window:{
   matchMedia:()=>({matches:true}),
   addEventListener:(type,fn)=>on(winListeners,type,fn)
 }
});
vm.runInContext(source,context);
const diag=context.window.LexiMusicDiagnostics;
assert(diag?.record);
const records=()=>JSON.parse(storage.get('lexiMusicPlaybackDiagnosticsV1'));
assert.equal(records()[0].stage,'prior-release-evidence','Old evidence must survive');
diag.record('transition-requested',{
 generation:7,queueIndex:1,targetIndex:2,queueSize:3,auto:true,direction:1,
 prefetched:true,prefetchReady:true,repeat:'all',targetOffline:true,
 trackId:'PRIVATE_TRACK_ID',title:'PRIVATE_SONG_TITLE',token:'PRIVATE_TOKEN'
});
const transition=records().at(-1);
assert.equal(transition.generation,7);assert.equal(transition.auto,true);
assert.equal(transition.targetIndex,2);assert.equal(transition.sourceKind,'blob');
for(const key of ['trackId','title','token'])assert.equal(key in transition,false);
now+=46000;audio.currentTime=47;emit(audioListeners,'timeupdate');
now+=10000;audio.currentTime=57;emit(audioListeners,'timeupdate');
assert.equal(records().filter(e=>e.stage==='audio:progress').length,1,'Sparse 45-second samples');
now+=47000;audio.currentTime=104;emit(audioListeners,'timeupdate');
assert.equal(records().filter(e=>e.stage==='audio:progress').length,2);
emit(winListeners,'settings:click');
for(const id of ['startPlaybackTest','lexiAudioAudible','lexiAudioSilent','sharePlaybackLog'])assert(buttons.has(id),id);
assert.equal(buttons.get('startPlaybackTest').type,'button');
(async()=>{
 await buttons.get('startPlaybackTest').click();
 assert.equal(closes,1);
 assert.equal(records().at(-1).stage,'test:start');
 context.document.hidden=true;context.document.visibilityState='hidden';
 emit(docListeners,'visibilitychange');
 now+=60000;audio.currentTime=105.5;audio.paused=true;audio.ended=true;
 emit(audioListeners,'ended');
 context.document.hidden=false;context.document.visibilityState='visible';
 emit(docListeners,'visibilitychange');
 const returned=records().at(-1);
 assert.equal(returned.stage,'background-return');
 assert.equal(returned.hiddenForSec,60);
 assert.equal(returned.playheadDelta,1.5);
 assert.equal(returned.wasPlaying,true);
 diag.record('background-continuous-handoff');
 diag.record('play-failed:NotAllowedError');
 await buttons.get('lexiAudioSilent').click();
 assert.equal(records().at(-1).stage,'user:silent','Keep v1.09 symptom marker');
 await buttons.get('sharePlaybackLog').click();
 assert.equal(sharedLogs.length,1);
 assert.equal(sharedLogs[0].diagnosticsBuild,'v3');
 assert.equal(sharedLogs[0].appVersion,'v1.10');
 assert.equal(sharedLogs[0].summary.result,'stopped');
 assert.equal(sharedLogs[0].summary.playbackFailures,1);
 assert.equal(sharedLogs[0].summary.naturalEnds,1);
 assert.equal(sharedLogs[0].summary.preEndHandoffs,1);
 assert.equal(sharedLogs[0].summary.backgroundReturns,1);
 assert(sharedLogs[0].events.some(e=>e.stage==='prior-release-evidence'));
 assert(!JSON.stringify(sharedLogs[0]).includes('PRIVATE_'),'No identifiers/secrets may be exported');
 await buttons.get('startPlaybackTest').click();
 diag.record('transition-requested',{auto:true,direction:1});
 diag.record('play-resolved');
 await buttons.get('lexiAudioAudible').click();
 await buttons.get('sharePlaybackLog').click();
 assert.equal(sharedLogs[1].summary.result,'worked');
 assert.equal(sharedLogs[1].summary.automaticTransitions,1);
 assert.equal(sharedLogs[1].summary.playbackStartsConfirmed,1);
 assert.equal(sharedLogs[1].summary.playbackFailures,0,'Summary only the latest test');
 emit(winListeners,'pagehide');
 assert.equal(records().at(-1).stage,'pagehide');
 console.log('PASS: v1.09 symptom markers/stall signals preserved; v1.10 passive diagnostics, privacy, sparse progress, hidden-return, test markers, export summary, old evidence');
})().catch(error=>{console.error(error);process.exitCode=1});
