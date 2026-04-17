window.musicCache = (() => {
    const dbName = "musicweb-player-cache";
    const storeName = "tracks";
    const settingsStore = "settings";
    const memoryUrls = new Map();

    // File System Access API handle
    let directoryHandle = null;

    // ---------- IndexedDB (fallback and metadata) ----------
    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 2); // Version bumped for new store

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

    // ---------- Settings (store directory handle permission) ----------
    async function getSetting(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(settingsStore, "readonly");
            const request = transaction.objectStore(settingsStore).get(key);
            request.onsuccess = () => resolve(request.result?.value ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async function setSetting(key, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(settingsStore, "readwrite");
            transaction.objectStore(settingsStore).put({ key, value });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // ---------- File System Access Helpers ----------
    function isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window;
    }

    async function restoreDirectoryHandle() {
        if (!isFileSystemAccessSupported()) return false;

        const stored = await getSetting('directoryHandle');
        if (!stored) return false;

        try {
            // Verify permission is still granted
            const handle = await stored;
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                directoryHandle = handle;
                return true;
            } else {
                // Request permission again
                const newPermission = await handle.requestPermission({ mode: 'readwrite' });
                if (newPermission === 'granted') {
                    directoryHandle = handle;
                    return true;
                }
            }
        } catch {
            // Handle expired or invalid
        }
        return false;
    }

    async function saveDirectoryHandle(handle) {
        if (!handle) return;
        directoryHandle = handle;
        // The handle is serializable; store it
        await setSetting('directoryHandle', handle);
    }

    // ---------- Public API ----------
    async function requestFolderAccess() {
        if (!isFileSystemAccessSupported()) {
            console.warn('File System Access API not supported in this browser.');
            return false;
        }

        try {
            const handle = await window.showDirectoryPicker();
            await saveDirectoryHandle(handle);
            console.log('Folder access granted:', handle.name);
            return true;
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('User cancelled folder selection.');
            } else {
                console.error('Folder selection error:', err);
            }
            return false;
        }
    }

    // Try to restore handle on load
    (async () => {
        await restoreDirectoryHandle();
    })();

    // Sanitize filename for filesystem
    function sanitizeFilename(name) {
        return name.replace(/[/\\?%*:|"<>]/g, '-');
    }

    // Get a file handle for a track
    async function getTrackFileHandle(id, remoteUrl, create = false) {
        if (!directoryHandle) return null;

        // Generate a filename based on id and remote URL extension
        const urlParts = remoteUrl.split('/');
        let filename = urlParts.pop() || `track-${id}`;
        // Ensure extension
        if (!filename.includes('.')) filename += '.mp3';
        filename = sanitizeFilename(filename);

        try {
            return await directoryHandle.getFileHandle(filename, { create });
        } catch {
            return null;
        }
    }

    async function getPlayableUrl(id) {
        // 1. Try IndexedDB blob URL cache
        const record = await readTrack(id);
        if (record?.blob) {
            if (memoryUrls.has(id)) {
                return memoryUrls.get(id);
            }
            const objectUrl = URL.createObjectURL(record.blob);
            memoryUrls.set(id, objectUrl);
            return objectUrl;
        }

        // 2. Try File System Access (if available)
        if (directoryHandle) {
            try {
                // We need remoteUrl to construct filename; get it from record or prefetch later
                const remoteUrl = record?.remoteUrl;
                if (remoteUrl) {
                    const fileHandle = await getTrackFileHandle(id, remoteUrl, false);
                    if (fileHandle) {
                        const file = await fileHandle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        memoryUrls.set(id, blobUrl);
                        return blobUrl;
                    }
                }
            } catch { /* ignore */ }
        }

        return null;
    }

    async function prefetchTrack(id, remoteUrl) {
        // Check existing
        const existing = await readTrack(id);
        if (existing?.blob) return true;

        // If we have file system access, check if file already exists there
        if (directoryHandle) {
            try {
                const fileHandle = await getTrackFileHandle(id, remoteUrl, false);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    // Optionally store reference in IndexedDB without blob
                    await writeTrack({ id, remoteUrl, blob: null, cachedAt: new Date().toISOString() });
                    return true;
                }
            } catch { /* file doesn't exist yet */ }
        }

        // Fetch from network
        try {
            const response = await fetch(remoteUrl, {
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });

            if (!response.ok) return false;

            const blob = await response.blob();

            // Save to IndexedDB (fallback)
            await writeTrack({ id, remoteUrl, blob, cachedAt: new Date().toISOString() });

            // Save to File System if available
            if (directoryHandle) {
                try {
                    const fileHandle = await getTrackFileHandle(id, remoteUrl, true);
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    console.log(`Saved to folder: ${fileHandle.name}`);
                    // We can keep blob in IndexedDB or set to null to save space; keep for now.
                } catch (fsError) {
                    console.warn('File system write failed, using IndexedDB only:', fsError);
                }
            }

            return true;
        } catch (error) {
            console.warn('Prefetch failed:', error);
            return false;
        }
    }

    // Check if folder access is currently active
    function isFolderAccessGranted() {
        return directoryHandle !== null;
    }

    // Revoke a blob URL when done (optional)
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
        isFolderAccessGranted,
        isFileSystemAccessSupported,
        revokeBlobUrl,
    };
})();