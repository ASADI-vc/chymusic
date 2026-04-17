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

    // Only handle GET requests for audio files
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(handleAudioRequest(event.request));
});

async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(request);
    if (cached && cached.type !== 'opaque') {
        return cached;
    }

    try {
        // Create a new request with a null referrer
        const corsRequest = new Request(request.url, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        });

        const response = await fetch(corsRequest);
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn('CORS fetch failed, falling back to network:', request.url);
        return Response.error();
    }
}