const fs = require('fs'), vm = require('vm'), assert = require('assert');
const http = require('http');

(async () => {
  // A real fetched redirect retains its URL list through Response.clone/cache.
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('index.html')) { res.writeHead(302, {Location: './'}); res.end(); }
    else { res.writeHead(200, {'Content-Type': 'text/html', 'X-Shell': 'fixture'}); res.end('saved app shell'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const redirected = await fetch(origin + '/index.html');
    assert(redirected.redirected);
    for (const [file, prefix] of [['dist/sw.js', '/'], ['dist/music-player/sw.js', '/music-player/']]) {
      const handlers = {}, entries = new Map(), deleted = [];
      const cache = {match: async key => entries.get(String(key))?.clone(), put: async (key, response) => entries.set(String(key), response.clone()), addAll: async () => {}};
      let offline = false, calls = 0;
      const context = {URL, Response, Headers, Promise, importScripts() {}, fetch: async request => { calls++; if (offline) throw Error('offline'); return redirected.clone(); },
        caches: {open: async () => cache, keys: async () => ['music-shell-old', 'music-routing-test-shell-old', 'sibling-cache'], delete: async key => {deleted.push(key); return true;}},
        self: {location: {origin}, registration: {scope: origin + prefix}, skipWaiting: async () => {}, clients: {claim: async () => {}}, addEventListener: (name, handler) => handlers[name] = handler}};
      context.self.LexiOfflineAudio = {handle: async () => new Response('local audio', {status:206})};
      vm.createContext(context); vm.runInContext(fs.readFileSync(file, 'utf8'), context);
      async function navigate(path, redirect = 'manual') {
        let response;
        handlers.fetch({request: {url: origin + path, method: 'GET', mode: 'navigate', redirect}, respondWith: promise => response = promise, waitUntil() {}});
        if (!response) return undefined;
        const result = await response;
        // Fetch's navigation redirect guard, matching the reported Safari failure.
        assert(!(result.redirected && redirect !== 'follow'), file + ': redirected response reached navigation');
        return result;
      }
      // Already-installed workers can have redirected index.html in CacheStorage.
      entries.set('./index.html', redirected.clone());
      const cached = await navigate(prefix);
      assert.equal(await cached.text(), 'saved app shell');
      assert.equal(cached.headers.get('Content-Type'), 'text/html');
      assert.equal(cached.headers.get('X-Shell'), 'fixture');
      offline = true;
      assert.equal(await (await navigate(prefix)).text(), 'saved app shell');
      offline = false; entries.clear();
      assert.equal(await (await navigate(prefix)).text(), 'saved app shell');
      if (prefix === '/') {
        const before = calls;
        for (const route of ['/signin-with-chatgpt', '/repair/', '/unrelated/']) assert.equal(await navigate(route), undefined);
        assert.equal(calls, before, 'authentication and repair navigations must go straight to network');
      } else {
        let media;
        handlers.fetch({request:{url:origin+prefix+'__offline_audio/test',method:'GET'},respondWith:p=>media=p});
        assert.equal((await media).status,206);
        assert.equal(await (await media).text(),'local audio');
      }
      let activation;
      handlers.activate({waitUntil:p=>activation=p}); await activation;
      assert(!deleted.includes('sibling-cache'));
      assert(!deleted.includes(prefix==='/'?'music-shell-old':'music-routing-test-shell-old'));
    }
    console.log('PASS: real redirected cached/network navigation, offline startup, auth/repair bypass, local audio and isolated cache cleanup');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error); process.exitCode = 1;});
