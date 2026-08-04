const CACHE = "retirement-tracker-v21-premium-skin";
const ASSETS = [
  "./",
  "./index.html",
  "./skin.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
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

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  const isPage = e.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/retirement-tracker/");

  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then(async res => {
          const html = await res.text();
          const styled = html.includes("skin.css")
            ? html
            : html.replace("</head>", '<link rel="stylesheet" href="./skin.css?v=21"></head>');
          const out = new Response(styled, {
            status: res.status,
            statusText: res.statusText,
            headers: {"Content-Type": "text/html; charset=utf-8"}
          });
          const copy = out.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return out;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match("./index.html")))
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
