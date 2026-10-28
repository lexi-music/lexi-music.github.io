const fs=require('fs'),crypto=require('crypto'),{execFileSync}=require('child_process');
const project=require('./check-project.cjs');
const paths=['index.html','music-player/index.html','music-player/app-player.js','music-player/audio-deck.js','music-player/playback-diagnostics.js','music-player/full-test-loader.js','music-player/sw.js'];
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==sha)throw Error('Workflow SHA does not match source');
const files=Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync('dist/'+p)).digest('hex')]));
fs.writeFileSync('dist/release.json',JSON.stringify({...project,commit:sha,files},null,2)+'\n');
console.log('Release prepared for '+project.productionOrigin+' at '+sha);
