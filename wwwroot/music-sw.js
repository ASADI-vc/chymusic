const AUDIO_CACHE = "musicweb-audio-v1";

self.addEventListener("install", event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    const requestUrl = new URL(event.request.url);
    const isAudioHost = requestUrl.hostname === "dl.musicsbaran.ir";

    if (!isAudioHost) {
        return;
    }

    event.respondWith(handleAudioRequest(event.request));
});

async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
    if (cached) {
        return cached;
    }

    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
    }

    return response;
}
