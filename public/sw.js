const AUDIO_CACHE = "nadam-audio-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith("/api/songs/") && event.request.method === "GET") {
    event.respondWith(cachedAudio(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_SONGS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheSongs(event.data.urls));
});

async function cachedAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function cacheSongs(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  for (const url of urls) {
    if (await cache.match(url)) continue;
    try {
      const response = await fetch(url);
      if (response.ok && response.status === 200) await cache.put(url, response);
    } catch {
      // Keep preparing the remaining songs when one download fails.
    }
  }
}