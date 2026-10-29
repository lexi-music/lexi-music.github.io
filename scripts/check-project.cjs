const fs = require('fs'), assert = require('node:assert/strict'), {execFileSync} = require('child_process');
const expected = {repository:'lexi-music/lexi-music.github.io',branch:'main',productionOrigin:'https://lexi-music.github.io',publishDirectory:'dist',workflow:'.github/workflows/pages.yml',playbackBuild:'v1.01'};
const project = JSON.parse(fs.readFileSync('project.json'));
assert.deepEqual(project, expected, 'Wrong project identity: stop before editing or publishing');
const remote = execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
assert(['https://github.com/'+project.repository+'.git','https://github.com/'+project.repository,'git@github.com:'+project.repository+'.git'].includes(remote),'Wrong Git origin');
if(process.env.GITHUB_REPOSITORY) assert.equal(process.env.GITHUB_REPOSITORY,project.repository);
if(process.env.GITHUB_EVENT_NAME === 'push' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') assert.equal(process.env.GITHUB_REF,'refs/heads/main');
const workflow = fs.readFileSync(project.workflow,'utf8');
assert.match(workflow,/needs: check/);assert.match(workflow,/node scripts\/check-project.cjs/);assert.match(workflow,/path: dist/);
assert(!fs.existsSync('.openai/hosting.json'),'Canonical app must not be published through Sites');
for(const name of ['dist/manifest.webmanifest','dist/music-player/manifest.json']) {
 const m=JSON.parse(fs.readFileSync(name));assert.equal(m.id,'/');assert.equal(m.scope,'/');assert.equal(m.start_url,'/');
}
assert(fs.readFileSync('AGENTS.md','utf8').includes(project.productionOrigin));
console.log('PASS: canonical repository, Git remote, production origin, branch, workflow dependency and PWA identity');
module.exports=project;
