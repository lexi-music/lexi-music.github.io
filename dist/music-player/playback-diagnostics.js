(() => {
 'use strict';
 // Diagnostic-only release. Never changes audio source, transport, downloads or authorization.
 const KEY='lexiMusicPlaybackDiagnosticsV1', LIMIT=450;
 let records=[];
 try { const saved=JSON.parse(localStorage.getItem(KEY)||'[]'); if(Array.isArray(saved))records=saved.slice(-LIMIT); } catch (_) {}
 const audio=window.LexiMusicAudio||document.getElementById('audio');
 const startedAt=Date.now(), boot=performance.now();
 let lastProgressAt=0, lastMediaTime=null, lastProgressWall=0, stallReported=false;
 function sourceKind(src) {
   if(!src)return 'none';
   if(src.startsWith('blob:'))return 'blob';
   if(src.includes('/__offline_audio/'))return 'local-media-url';
   return 'other';
 }
 function snapshot(stage, extra) {
   const now=Date.now(), entry={
     at:new Date(now).toISOString(), stage, elapsedMs:now-startedAt,
     visible:document.visibilityState, online:navigator.onLine,
     appVersion:document.documentElement.dataset.appVersion||'unknown',
     mediaState:navigator.mediaSession?.playbackState||'',
     audioSessionState:navigator.audioSession?.state||'',
     standalone:navigator.standalone===true||!!window.matchMedia?.('(display-mode: standalone)').matches,
     swControlled:!!navigator.serviceWorker?.controller
   };
   if(audio){
     let bufferEnd=null;
     try{if(audio.buffered?.length)bufferEnd=Math.round(audio.buffered.end(audio.buffered.length-1)*10)/10}catch(_){}
     Object.assign(entry,{
       time:Math.round((audio.currentTime||0)*10)/10,
       duration:Number.isFinite(audio.duration)?Math.round(audio.duration*10)/10:null,
       paused:audio.paused, ended:audio.ended, muted:audio.muted,
       volume:audio.volume, playbackRate:audio.playbackRate,
       ready:audio.readyState, network:audio.networkState, bufferEnd,
       sourceKind:sourceKind(audio.currentSrc||audio.src||''),
       error:audio.error?.code||0
     });
   }
   if(extra)Object.assign(entry,extra);
   records.push(entry);
   if(records.length>LIMIT)records=records.slice(-LIMIT);
   try{localStorage.setItem(KEY,JSON.stringify(records))}catch(_){}
 }
 function record(stage){snapshot(String(stage).slice(0,120))}
 window.LexiMusicDiagnostics=Object.freeze({record});
 if(audio){
   for(const name of ['loadstart','play','playing','pause','ended','waiting','stalled','suspend','canplay','canplaythrough','error','emptied','abort','seeking','seeked','loadedmetadata','ratechange','volumechange']){
     audio.addEventListener(name,()=>{if(name==='playing'||name==='loadstart'||name==='seeking'){stallReported=false;lastProgressWall=Date.now()}record('audio:'+name)});
   }
   audio.addEventListener('timeupdate',()=>{
     const now=Date.now(),t=audio.currentTime||0;
     if(lastMediaTime===null||t>lastMediaTime+0.1){lastProgressWall=now;stallReported=false}
     lastMediaTime=t;
     if(now-lastProgressAt>=3000){lastProgressAt=now;record('audio:progress')}
   });
 }
 document.addEventListener('visibilitychange',()=>{
   snapshot('visibility',{hiddenDurationMs:document.visibilityState==='visible'&&lastHiddenAt!==null?Date.now()-lastHiddenAt:null});
   if(document.visibilityState==='hidden')lastHiddenAt=Date.now();else lastHiddenAt=null;
 });
 let lastHiddenAt=document.visibilityState==='hidden'?Date.now():null;
 window.addEventListener('pageshow',()=>record('pageshow'));
 window.addEventListener('pagehide',()=>record('pagehide'));
 window.addEventListener('focus',()=>record('window:focus'));
 window.addEventListener('blur',()=>record('window:blur'));
 navigator.serviceWorker?.addEventListener?.('controllerchange',()=>record('sw:controllerchange'));
 // Timers can be suspended by iOS. This records an observation only when the JS thread runs again.
 setInterval(()=>{
   if(!audio||audio.paused||audio.ended||lastProgressWall===0)return;
   const noProgressMs=Date.now()-lastProgressWall;
   if(noProgressMs>8000&&!stallReported){stallReported=true;snapshot('diagnostic:no-media-progress',{noProgressMs})}
 },4000);
 function mark(stage){
   const noProgressMs=lastProgressWall?Date.now()-lastProgressWall:null;
   snapshot('user:'+stage,{noProgressMs});
 }
 async function share(){
   snapshot('diagnostic:export');
   const payload={schema:2,diagnosticsBuild:'v2',appVersion:document.documentElement.dataset.appVersion,
     origin:location.origin,userAgent:navigator.userAgent,events:records};
   const file=new File([JSON.stringify(payload,null,2)],'lexi-music-playback-log.json',{type:'application/json'});
   if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){if(e.name==='AbortError')return}}
   const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function addButton(){
   const dialog=document.getElementById('settingsDialog');
   if(!dialog||document.getElementById('sharePlaybackLog'))return;
   const wrap=document.createElement('div');
   wrap.className='settings-section';
   const label=document.createElement('div');label.className='settings-section-title';label.textContent='Playback diagnostics';
   const note=document.createElement('p');note.className='help';note.textContent='Mark what you actually hear. These markers only record evidence; they do not control playback.';
   wrap.append(label,note);
   for(const [id,text,stage] of [['lexiAudioAudible','I hear audio','audible'],['lexiAudioSilent','Audio silent / stopped','silent']]){
     const button=document.createElement('button');button.id=id;button.type='button';button.className='button secondary';button.textContent=text;
     button.style.marginRight='8px';button.style.marginBottom='8px';
     button.addEventListener('click',()=>mark(stage));wrap.append(button);
   }
   const exportButton=document.createElement('button');exportButton.id='sharePlaybackLog';exportButton.type='button';
   exportButton.className='button secondary';exportButton.textContent='Share playback log';exportButton.addEventListener('click',share);
   wrap.append(exportButton);
   const form=dialog.querySelector('form');
   const actions=form?.querySelector('.dialog-actions');
   if(actions?.parentNode)actions.parentNode.insertBefore(wrap,actions);else dialog.append(wrap);
 }
 document.getElementById('settingsBtn')?.addEventListener('click',()=>setTimeout(addButton,0));
 record('diagnostics-ready');
})();
