const {spawnSync}=require('child_process'),assert=require('node:assert/strict');
for(const env of [
 {GITHUB_REPOSITORY:'wrong-owner/wrong-app'},
 {GITHUB_REPOSITORY:'lexi-music/lexi-music.github.io',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/retired-test'}
]){
 const r=spawnSync(process.execPath,['scripts/check-project.cjs'],{encoding:'utf8',env:{...process.env,...env}});
 assert.notEqual(r.status,0,'Wrong production identity must fail');
}
console.log('PASS: wrong repository and wrong publishing branch are rejected');
