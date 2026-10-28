/* Cached-loader compatibility: one native, user-authorized audio element. */
(() => {
  'use strict';
  const audio = document.getElementById('audio');
  if (audio) window.LexiMusicAudio = audio;
})();
