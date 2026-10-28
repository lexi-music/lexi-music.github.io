const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {harness,flush}=require('./playback-transitions.cjs');
(async()=>{
 const h=harness({nativeClock:true});
 vm.runInContext(fs.readFileSync('dist/music-player/audio-deck.js','utf8'),h.context);
 assert.equal(h.context.window.LexiMusicAudio,h.audio,'compatibility loader must retain original native player');
 const operations=[];let src=h.audio.src;
 Object.defineProperty(h.audio,'src',{get:()=>src,set(value){src=value;h.audio.currentTime=0;operations.push('source:'+value)}});
 const pause=h.audio.pause.bind(h.audio);h.audio.pause=()=>{operations.push('pause');pause()};
 h.audio.play=()=>{operations.push('play:'+src);h.audio.paused=false;return Promise.resolve()};
 // Each Media Session Next must reuse this element and play before yielding.
 for(let i=0;i<12;i++){
  const target=['B','C','A'][i%3];h.player.prepare(target);operations.length=0;
  const task=h.actions.nexttrack();
  assert.deepEqual(operations,['source:'+target+'.mp3','play:'+target+'.mp3']);
  assert.equal(h.audio.muted,false); // There is no muted secondary player to adopt.
  h.audio.currentTime=.5;h.emit('timeupdate');await task;await flush();
  assert.equal(h.player.state().currentTrackId,target);assert.equal(h.player.state().playbackLoading,false);
 }
 // An unresolved native play must be cancelled before a newer source owns it.
 h.player.prepare('B');h.audio.play=()=>{h.audio.paused=false;return new Promise(()=>{})};
 const stale=h.actions.nexttrack();h.player.prepare('C');
 h.audio.play=()=>{h.audio.paused=false;return Promise.resolve()};const latest=h.actions.nexttrack();
 h.audio.currentTime=.5;h.emit('timeupdate');await Promise.all([stale,latest]);
 assert.equal(h.player.state().currentTrackId,'C');assert.equal(h.audio.paused,false);
 // Natural repeat invokes the same single-player path.
 h.player.repeat('one');h.player.prepare('C');const repeat=h.player.playTrack('C',true);
 h.audio.currentTime=.5;h.emit('timeupdate');await repeat;
 assert.equal(h.audio.src,'C.mp3');
 const failed=harness({nativeClock:true});failed.audio.play=()=>Promise.reject(Error('native rejection'));
 assert.equal(await failed.player.playTrack('B',true),false);assert.equal(failed.audio.paused,true);
 assert.equal(failed.player.state().playbackLoading,false);
 const paused=harness({nativeClock:true});paused.player.prepare('B');const pending=paused.actions.nexttrack();paused.actions.pause();await pending;
 assert.equal(paused.audio.paused,true);assert.equal(paused.player.state().wantsPlayback,false);
 console.log('PASS: 12 successive Media Session skips synchronously reuse original native player; rapid supersession, clock confirmation, repeat');
})().catch(e=>{console.error(e);process.exitCode=1});
