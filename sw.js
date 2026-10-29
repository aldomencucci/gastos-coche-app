const CACHE = "gastos-coche-v1";
const ASSETS = ["./index.html", "./app.js", "./manifest.json", "./icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  // Never cache Supabase API calls — siempre red fresca para datos
  if (e.request.url.includes("supabase.co")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
