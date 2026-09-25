const APP_CACHE = "challenging-youth-app-v1";
const AUDIO_CACHE = "challenging-youth-audio-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/logo.jpeg", "/songs.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== APP_CACHE && key !== AUDIO_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.startsWith("/api/songs/") && request.mode === "cors") {
    event.respondWith(cachedAudio(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (requestUrl.pathname === "/" || /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|json|woff2?|ttf|map)$/i.test(requestUrl.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_SONGS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheSongs(event.data.urls, event.data.priorityUrl));
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(APP_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cachedApp = await caches.match(request) || await caches.match("/");
    if (cachedApp) return cachedApp;
    return caches.match("/songs.json");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request) || caches.match("/songs.json");
  }
}

async function cachedAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request.url) || Response.error();
  }
}

async function cacheSongs(urls, priorityUrl) {
  const cache = await caches.open(AUDIO_CACHE);
  const orderedUrls = priorityUrl ? [priorityUrl, ...urls.filter((url) => url !== priorityUrl)] : urls;
  for (let index = 0; index < orderedUrls.length; index += 4) {
    await Promise.all(orderedUrls.slice(index, index + 4).map(async (url) => {
      if (!url || await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (response.ok && response.status === 200) await cache.put(url, response);
      } catch {
        // Keep preparing the remaining songs when one download fails.
      }
    }));
  }
}