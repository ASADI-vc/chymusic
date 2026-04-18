window.playlistStorage = (() => {
    const dbName = "musicweb-playlists";
    const storeName = "playlists";

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

    async function getAllPlaylists() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(JSON.stringify(req.result || []));
            req.onerror = () => reject(req.error);
        });
    }

    async function getPlaylist(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result ? JSON.stringify(req.result) : null);
            req.onerror = () => reject(req.error);
        });
    }

    async function savePlaylist(playlistJson) {
        const db = await openDb();
        const playlist = JSON.parse(playlistJson);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(playlist);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function deletePlaylist(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    return {
        getAllPlaylists,
        getPlaylist,
        savePlaylist,
        deletePlaylist,
    };
})();