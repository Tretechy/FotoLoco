// Offline-Unterstützung: Die App selbst (Code, Schriften, Daten) wird auf dem Gerät zwischengespeichert.
// Kartenbilder, Wetter und Suche brauchen weiterhin Internet.
const CACHE = "fotoloco-v3";
const FILES = [
  "./", "index.html", "css/app.css", "js/app.js", "js/astro.js", "js/store.js", "js/pins.js",
  "vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "vendor/suncalc.js", "vendor/tz-lookup.js",
  "data/cities.json", "data/beispiel-spots.json", "manifest.webmanifest", "icons/icon.svg",
  "fonts/archivo-latin-600-normal.woff2", "fonts/archivo-latin-800-normal.woff2",
  "fonts/instrument-sans-latin-400-normal.woff2", "fonts/instrument-sans-latin-500-normal.woff2", "fonts/instrument-sans-latin-600-normal.woff2",
  "fonts/jetbrains-mono-latin-400-normal.woff2", "fonts/jetbrains-mono-latin-500-normal.woff2",
  "impressum.html", "datenschutz.html"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Eigene Dateien: erst Netz (damit Updates sofort ankommen), bei fehlender Verbindung aus dem Speicher.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html")))
  );
});
