const APP_CACHE = "challenging-youth-app-v2";
const AUDIO_CACHE = "challenging-youth-audio-v2";
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

  if ((requestUrl.pathname.startsWith("/api/songs/") && request.mode === "cors") || requestUrl.pathname.startsWith("/audio/")) {
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
  if (event.data?.type !== "CACHE_LIBRARY" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheLibrary(event.data.urls, event.source?.id));
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
  if (cached) return request.headers.has("range") ? rangedResponse(cached, request.headers.get("range")) : cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch {
    const offlineAudio = await cache.match(request.url);
    if (!offlineAudio) return Response.error();
    return request.headers.has("range") ? rangedResponse(offlineAudio, request.headers.get("range")) : offlineAudio;
  }
}

async function cacheLibrary(urls, clientId) {
  const cache = await caches.open(AUDIO_CACHE);
  const client = clientId ? await self.clients.get(clientId) : null;
  const audioUrls = [...new Set(urls.filter((url) => typeof url === "string" && url.startsWith("/audio/")))];
  let completed = 0;
  const report = (type, message) => client?.postMessage({ type, completed, total: audioUrls.length, message });

  try {
    for (const url of audioUrls) {
      if (!(await cache.match(url))) {
        const response = await fetch(url);
        if (!response.ok || response.status !== 200) throw new Error(`Could not download ${url}.`);
        await cache.put(url, response);
      }
      completed += 1;
      report("LIBRARY_CACHE_PROGRESS");
    }
    report("LIBRARY_CACHE_COMPLETE");
  } catch (error) {
    report("LIBRARY_CACHE_ERROR", error instanceof Error ? error.message : "Offline download failed.");
  }
}

async function rangedResponse(response, rangeHeader) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader ?? "");
  if (!match) return response;

  const body = await response.arrayBuffer();
  const start = Number(match[1]);
  const end = Math.min(match[2] ? Number(match[2]) : body.byteLength - 1, body.byteLength - 1);
  if (start >= body.byteLength || end < start) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${body.byteLength}` } });
  }

  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}