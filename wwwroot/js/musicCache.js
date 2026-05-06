window.musicCache = (() => {
    const dbName = "musicweb-player-cache";
    const storeName = "tracks";
    const settingsStore = "settings";
    const memoryUrls = new Map();

    let directoryHandle = null;

    // ---------- IndexedDB ----------
    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 2);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(settingsStore)) {
                    db.createObjectStore(settingsStore, { keyPath: "key" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function readTrack(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    }

    async function writeTrack(record) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(record);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getSetting(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(settingsStore, "readonly");
            const req = tx.objectStore(settingsStore).get(key);
            req.onsuccess = () => resolve(req.result?.value ?? null);
            req.onerror = () => reject(req.error);
        });
    }

    async function setSetting(key, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(settingsStore, "readwrite");
            tx.objectStore(settingsStore).put({ key, value });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    // ---------- File System Access ----------
    function isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window;
    }

    async function hasStoredHandle() {
        if (!isFileSystemAccessSupported()) return false;
        const stored = await getSetting('directoryHandle');
        return !!stored;
    }

    async function reconnectFolder() {
        if (!isFileSystemAccessSupported()) return false;

        const stored = await getSetting('directoryHandle');
        if (!stored) return false;

        try {
            const permission = await stored.requestPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                directoryHandle = stored;
                console.log(`📁 Reconnected to folder: ${directoryHandle.name}`);
                return true;
            }
        } catch (err) {
            console.error('Reconnect failed:', err);
        }
        return false;
    }

    async function requestFolderAccess() {
        if (!isFileSystemAccessSupported()) return false;

        try {
            const handle = await window.showDirectoryPicker();
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                directoryHandle = handle;
                await setSetting('directoryHandle', handle);
                console.log(`📁 New folder selected: ${handle.name}`);
                return true;
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('User cancelled folder selection.');
            } else {
                console.error('Folder selection error:', err);
            }
        }
        return false;
    }

    function isFolderAccessGranted() {
        return directoryHandle !== null;
    }

    // Sanitize filename
    function sanitizeFilename(name) {
        return name.replace(/[/\\?%*:|"<>]/g, '-');
    }

    async function getTrackFileHandle(id, remoteUrl, create = false) {
        if (!directoryHandle) return null;

        const urlParts = remoteUrl.split('/');
        let filename = urlParts.pop() || `track-${id}`;
        if (!filename.includes('.')) filename += '.mp3';
        filename = sanitizeFilename(filename);

        try {
            return await directoryHandle.getFileHandle(filename, { create });
        } catch {
            return null;
        }
    }

    // ---------- Public API ----------

    /**
     * Returns a playable URL for the track.
     * 1. Memory cache
     * 2. IndexedDB blob
     * 3. File system (if folder access granted) – also rebuilds IndexedDB record if missing
     */
    async function getPlayableUrl(id, remoteUrl) {
        // Memory cache
        if (memoryUrls.has(id)) {
            return memoryUrls.get(id);
        }

        // IndexedDB
        const record = await readTrack(id);
        if (record?.blob) {
            const url = URL.createObjectURL(record.blob);
            memoryUrls.set(id, url);
            return url;
        }

        // File system – if record missing but we have folder access
        if (directoryHandle && remoteUrl) {
            try {
                const fileHandle = await getTrackFileHandle(id, remoteUrl, false);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    // Rebuild the IndexedDB record so it doesn't re-download
                    await writeTrack({
                        id,
                        remoteUrl,
                        blob: null,       // blob is on disk now
                        cachedAt: new Date().toISOString()
                    });
                    const url = URL.createObjectURL(file);
                    memoryUrls.set(id, url);
                    return url;
                }
            } catch { /* file not found in folder */ }
        }

        return null;
    }

    /**
     * Prefetch and cache a track for offline use.
     * If it already exists in IndexedDB or in the file system, no download occurs.
     */
    async function prefetchTrack(id, remoteUrl) {
        // Already cached in IndexedDB
        const existing = await readTrack(id);
        if (existing?.blob) return true;

        // Check file system – if present, just update IndexedDB
        if (directoryHandle) {
            try {
                const fileHandle = await getTrackFileHandle(id, remoteUrl, false);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    await writeTrack({ id, remoteUrl, blob: null, cachedAt: new Date().toISOString() });
                    return true;
                }
            } catch { /* not in folder */ }
        }

        // Download from network with retry
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(remoteUrl, {
                    mode: "cors",
                    cache: "no-store",
                    credentials: "omit",
                    referrerPolicy: "no-referrer",
                });

                if (!response.ok) {
                    if (response.status === 403 && attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 500 * attempt));
                        continue;
                    }
                    return false;
                }

                const contentType = response.headers.get('Content-Type') || '';
                if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
                    console.warn('Prefetch returned non‑audio content type:', contentType);
                    return false;
                }

                const blob = await response.blob();
                await writeTrack({ id, remoteUrl, blob, cachedAt: new Date().toISOString() });

                if (directoryHandle) {
                    try {
                        const fileHandle = await getTrackFileHandle(id, remoteUrl, true);
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    } catch (fsError) {
                        console.warn('File system write failed:', fsError);
                    }
                }
                return true;
            } catch (error) {
                if (attempt === maxRetries) {
                    console.warn('Prefetch failed after retries:', error);
                    return false;
                }
                await new Promise(r => setTimeout(r, 500 * attempt));
            }
        }
        return false;
    }

    function revokeBlobUrl(id) {
        const url = memoryUrls.get(id);
        if (url) {
            URL.revokeObjectURL(url);
            memoryUrls.delete(id);
        }
    }

    return {
        getPlayableUrl,
        prefetchTrack,
        requestFolderAccess,
        reconnectFolder,
        hasStoredHandle,
        isFolderAccessGranted,
        isFileSystemAccessSupported,
        revokeBlobUrl,
    };
})();