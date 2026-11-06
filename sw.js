/* Forge service worker: offline app shell. Python (Pyodide) still needs a connection on first load. */
const CACHE = "forge-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "content.js", "worker.js", "harness.py", "tests.json", "icon.svg", "manifest.webmanifest", "vendor/codemirror.js", "vendor/codemirror.css", "vendor/katex.min.js", "vendor/auto-render.min.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
