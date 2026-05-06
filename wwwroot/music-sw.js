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

    // 1. Skip dynamic module imports
    if (requestUrl.pathname.startsWith("/js/")) {
        return;
    }

    // 2. Data files – stale-while-revalidate
    if (requestUrl.pathname.startsWith("/data/")) {
        event.respondWith(handleDataRequest(event.request));
        return;
    }

    // 3. Proxied audio – dedicated cache with range support
    if (requestUrl.pathname.startsWith("/proxy.php")) {
        event.respondWith(handleAudioRequest(event.request));
        return;
    }

    // 4. All other same‑origin GET requests – cache first, then network
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
 * Audio request handler – caches full responses and serves range requests from cache
 */
async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
        const cached = await cache.match(request.url, { ignoreSearch: true });
        if (cached && cached.ok) {
            try {
                const blob = await cached.blob();
                const [start, end] = parseRange(rangeHeader, blob.size);
                const sliced = blob.slice(start, end + 1);
                return new Response(sliced, {
                    status: 206,
                    headers: {
                        'Content-Range': `bytes ${start}-${end}/${blob.size}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': sliced.size,
                        'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg'
                    }
                });
            } catch (err) {
                console.warn('Failed to slice cached audio, re-fetching');
            }
        }
        // No cache – fetch full file
        const fullResponse = await fetch(request.url);
        if (!fullResponse.ok) return fullResponse;
        const blob = await fullResponse.blob();
        await cache.put(request.url, new Response(blob, {
            headers: fullResponse.headers
        }));
        const [start, end] = parseRange(rangeHeader, blob.size);
        const sliced = blob.slice(start, end + 1);
        return new Response(sliced, {
            status: 206,
            headers: {
                'Content-Range': `bytes ${start}-${end}/${blob.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': sliced.size,
                'Content-Type': fullResponse.headers.get('Content-Type') || 'audio/mpeg'
            }
        });
    }

    // Normal request – cache first
    const cached = await cache.match(request.url, { ignoreSearch: true });
    if (cached && cached.ok) {
        return cached;
    }

    const networkResponse = await fetch(request.url);
    if (networkResponse.ok) {
        await cache.put(request.url, networkResponse.clone());
    }
    return networkResponse;
}

function parseRange(rangeHeader, totalSize) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return [0, totalSize - 1];
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
    return [start, Math.min(end, totalSize - 1)];
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