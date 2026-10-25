const CACHE = 'music-routing-test-shell-v4';
const SHELL = ['./', './manifest.webmanifest?v=3', './music-player/lexi-music-icon.png?v=1', './icon.png'];

// A cached page may retain the host's canonical-directory redirect history.
// Safari navigation cannot consume that history via respondWith().
function navigationResponse(response) {
  if (!response.redirected) return response;
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('music-routing-test-shell-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Leave authentication and repair routes to normal browser navigation.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.mode !== 'navigate' || !['/', '/index.html'].includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match('./') || await cache.match('./index.html');
    if (saved) return navigationResponse(saved);
    return navigationResponse(await fetch(request));
  })());
});
