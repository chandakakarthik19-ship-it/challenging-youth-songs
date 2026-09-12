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
  event.waitUntil(cacheSongs(event.data.urls, event.data.priorityUrl));
});

async function cachedAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function cacheSongs(urls, priorityUrl) {
  const cache = await caches.open(AUDIO_CACHE);
  const orderedUrls = priorityUrl ? [priorityUrl, ...urls.filter((url) => url !== priorityUrl)] : urls;
  for (let index = 0; index < orderedUrls.length; index += 4) {
    await Promise.all(orderedUrls.slice(index, index + 4).map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (response.ok && response.status === 200) await cache.put(url, response);
      } catch {
        // Keep preparing the remaining songs when one download fails.
      }
    }));
  }
}