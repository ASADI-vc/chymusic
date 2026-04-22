const APP_CACHE = "musicweb-app-v1";
const DATA_CACHE = "musicweb-data-v1";
const AUDIO_CACHE = "musicweb-audio-v1";

const APP_FILES = [
    "/",
    "/index.html",
    "/css/app.css",
    "/MusicWeb.styles.css",
    "/icon/favicon.png",
    "/manifest.json",
    "/_framework/blazor.webassembly.js",
    "/data/catalog-summary.json",
    "/data/search-index.json",
    "/data/featured.json",
    "/data/fresh-tracks.json"
];

self.addEventListener("install", event => {
    event.waitUntil(
        Promise.all([
            self.skipWaiting(),
            caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES))
        ])
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    const requestUrl = new URL(event.request.url);
    const isAudioHost = requestUrl.hostname === "dl.musicsbaran.ir";

    if (isAudioHost) {
        if (event.request.method !== 'GET') return;
        event.respondWith(handleAudioRequest(event.request));
        return;
    }

    if (requestUrl.pathname.startsWith("/js/")) {
        return;
    }

    if (requestUrl.pathname.startsWith("/data/")) {
        event.respondWith(handleDataRequest(event.request));
        return;
    }

    if (event.request.method === 'GET' && requestUrl.origin === location.origin) {
        event.respondWith(
            caches.open(APP_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }
});

/**
 * Audio request handler with retry logic (up to 5 attempts) for 403 errors.
 */
async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(request);
    if (cached && cached.type !== 'opaque') {
        return cached;
    }

    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const corsRequest = new Request(request.url, {
                mode: 'cors',
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            });
            const response = await fetch(corsRequest);

            if (response.ok) {
                await cache.put(request, response.clone());
                return response;
            }

            if (response.status === 403) {
                console.warn(`Audio fetch attempt ${attempt} returned 403 for ${request.url}`);
                lastError = new Error(`HTTP 403 Forbidden (attempt ${attempt})`);
                if (attempt < maxRetries) {
                    // Exponential backoff: 300ms, 600ms, 1.2s, 2.4s
                    await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
                }
                continue;
            }

            // Other HTTP errors – do not retry
            return response;
        } catch (error) {
            console.warn(`Audio fetch attempt ${attempt} failed:`, error);
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
            }
        }
    }

    console.error(`All ${maxRetries} attempts failed for ${request.url}. Last error:`, lastError);
    return Response.error();
}

async function handleDataRequest(request) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then(async response => {
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    }).catch(err => {
        console.warn('Data fetch failed, using cache only:', err);
    });

    try {
        return cached || await fetchPromise;
    } catch {
        return new Response('{"error": "Offline and not cached"}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}