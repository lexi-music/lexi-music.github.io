(async()=>{
 'use strict';
 const scripts=['audio-deck.js?v=4','playback-diagnostics.js?v=8','metadata.js?v=1','app-player.js?v=12','player-settings.js?v=3','playlist-enhancements.js?v=7','now-playing-fullscreen-v3.js?v=2'];
 try{
  const reserved=document.createElement('script');reserved.type='application/json';reserved.dataset.playlistEnhancements='reserved';document.body.append(reserved);
  for(const src of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;if(src.startsWith('playlist-'))s.dataset.playlistEnhancements='1';if(src.startsWith('app-player'))s.dataset.lexiMusicPlayer='1';s.onload=resolve;s.onerror=()=>reject(Error('Could not load player'));document.body.append(s)});
  reserved.remove();
  document.querySelector('.tab[data-view="GYM"]')?.click();
 }catch(error){document.getElementById('statusDetail').textContent=error.message+' · reopen online';}
})();
