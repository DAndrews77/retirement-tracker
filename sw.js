const CACHE = "retirement-tracker-v46-per-account-rates";
const ASSETS = [
  "./",
  "./index.html",
  "./skin.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./favicon.svg",
  "./hero-space.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* The HTML carries all the app's markup, CSS and JS inline, so serving it from
   cache first meant a deploy needed two loads to show up — the first load
   handed back the stale page and only refreshed the cache behind it. Navigations
   and index.html now go to the network first and fall back to cache when
   offline; everything else (icons, the hero photo) stays cache-first, since
   those only change when their filename or the cache version does. */
const isHTML = req =>
  req.mode === "navigate" ||
  new URL(req.url).pathname.replace(/\/$/, "").endsWith("/index.html") ||
  new URL(req.url).pathname.endsWith("/");

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  if (isHTML(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
