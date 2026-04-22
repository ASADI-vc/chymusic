const APP_CACHE = "musicweb-app-v1";
const DATA_CACHE = "musicweb-data-v1";
const AUDIO_CACHE = "musicweb-audio-v1";

// Core static files (precached at install)
const APP_FILES = [
    "/",
    "/index.html",
    "/css/app.css",
    "/MusicWeb.styles.css",
    "/icon/favicon.png",
    "/manifest.json",
    // Core data files for offline startup
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

    // 1. Audio requests – handled separately (CORS)
    if (isAudioHost) {
        if (event.request.method !== 'GET') return;
        event.respondWith(handleAudioRequest(event.request));
        return;
    }

    // 2. Blazor framework and /js/ files – cache first, then network
    if (requestUrl.pathname.startsWith("/_framework/") ||
        requestUrl.pathname.startsWith("/js/")) {
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

    // 3. Data files (catalog JSON) – stale-while-revalidate
    if (requestUrl.pathname.startsWith("/data/")) {
        event.respondWith(handleDataRequest(event.request));
        return;
    }

    // 4. App shell and other same-origin assets – cache first, fallback to network
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

    // 5. Everything else (e.g., external images) – network only
});

/**
 * Audio request handler – uses a separate cache, handles CORS
 */
async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(request);
    if (cached && cached.type !== 'opaque') {
        return cached;
    }

    try {
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

/**
 * Data file handler – stale-while-revalidate
 */
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