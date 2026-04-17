window.musicCache = (() => {
    const dbName = "musicweb-player-cache";
    const storeName = "tracks";
    const memoryUrls = new Map();

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: "id" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function readTrack(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).get(id);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async function writeTrack(record) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).put(record);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function getPlayableUrl(id) {
        const record = await readTrack(id);
        if (!record || !record.blob) {
            return null;
        }

        if (memoryUrls.has(id)) {
            return memoryUrls.get(id);
        }

        const objectUrl = URL.createObjectURL(record.blob);
        memoryUrls.set(id, objectUrl);
        return objectUrl;
    }

    async function prefetchTrack(id, remoteUrl) {
        const existing = await readTrack(id);
        if (existing?.blob) {
            return true;
        }

        try {
            const response = await fetch(remoteUrl, {
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });

            if (!response.ok) {
                return false;
            }

            const blob = await response.blob();
            await writeTrack({ id, remoteUrl, blob, cachedAt: new Date().toISOString() });
            return true;
        } catch {
            return false;
        }
    }

    return {
        getPlayableUrl,
        prefetchTrack,
    };
})();
