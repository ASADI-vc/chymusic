const APP_CACHE = "musicweb-app-v1";
const DATA_CACHE = "musicweb-data-v1";

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
    // Delete any old audio caches that might exist from previous versions
    event.waitUntil(
        (async () => {
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys
                    .filter(key => key !== APP_CACHE && key !== DATA_CACHE)
                    .map(key => caches.delete(key))
            );
            await self.clients.claim();
        })()
    );
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

    // 3. Proxied audio – DO NOT CACHE, just pass through
    if (requestUrl.pathname.startsWith("/proxy.php")) {
        // Simply fetch from network – no service worker caching
        return; // event.respondWith() not called -> network only
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