/* Forge service worker: offline app shell. Network first, always revalidated, so a deploy is never mixed with stale files.
   Bump ?v= in index.html and CACHE here on each release. Python (Pyodide) still needs a connection on first load. */
const CACHE = "forge-v18";
const SHELL = ["./", "index.html", "style.css", "app.js", "content.js", "path.js", "drills.js", "shape.js", "sync.js", "drill_prelude.py", "worker.js", "harness.py", "tests.json", "icon.svg", "manifest.webmanifest", "vendor/codemirror.js", "vendor/codemirror.css", "vendor/active-line.js", "vendor/katex.min.js", "vendor/auto-render.min.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || u.pathname.startsWith("/api/") || e.request.method !== "GET") return; // API is never cached
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
