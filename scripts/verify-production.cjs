const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const expected=JSON.parse(fs.readFileSync('dist/release.json'));
const origin='https://lexi-music.github.io';assert.equal(expected.productionOrigin,origin);
async function get(path){const r=await fetch(origin+'/'+path+'?verify='+expected.commit,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});assert(r.ok,`${path}: HTTP ${r.status}`);return r;}
(async()=>{
 let last;
 for(let attempt=0;attempt<8;attempt++){
  try{
   const live=await (await get('release.json')).json();assert.equal(live.commit,expected.commit,'Production is serving a different commit');assert.equal(live.playbackBuild,expected.playbackBuild);
   for(const [path,hash]of Object.entries(expected.files)) {const bytes=await(await get(path)).arrayBuffer();assert.equal(crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'),hash,'Production mismatch: '+path);}
   console.log('VERIFIED '+origin+' commit '+expected.commit+' build '+expected.playbackBuild);return;
  }catch(e){last=e;if(attempt<7)await new Promise(r=>setTimeout(r,5000));}
 }
 throw last;
})().catch(e=>{console.error(e);process.exitCode=1});
