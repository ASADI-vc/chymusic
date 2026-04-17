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

    // Check if we have a stored handle (but permission may be missing)
    async function hasStoredHandle() {
        if (!isFileSystemAccessSupported()) return false;
        const stored = await getSetting('directoryHandle');
        return !!stored;
    }

    // Called when user clicks "Reconnect Folder"
    async function reconnectFolder() {
        if (!isFileSystemAccessSupported()) return false;

        const stored = await getSetting('directoryHandle');
        if (!stored) return false;

        try {
            // Request permission – must be triggered by user click
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
            // Request permission immediately to ensure it's granted
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

    async function getPlayableUrl(id) {
        if (memoryUrls.has(id)) {
            return memoryUrls.get(id);
        }

        const record = await readTrack(id);
        if (record?.blob) {
            const url = URL.createObjectURL(record.blob);
            memoryUrls.set(id, url);
            return url;
        }

        if (directoryHandle && record?.remoteUrl) {
            try {
                const fileHandle = await getTrackFileHandle(id, record.remoteUrl, false);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    const url = URL.createObjectURL(file);
                    memoryUrls.set(id, url);
                    return url;
                }
            } catch {}
        }

        return null;
    }

    async function prefetchTrack(id, remoteUrl) {
        const existing = await readTrack(id);
        if (existing?.blob) return true;

        if (directoryHandle) {
            try {
                const fileHandle = await getTrackFileHandle(id, remoteUrl, false);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    await writeTrack({ id, remoteUrl, blob: null, cachedAt: new Date().toISOString() });
                    return true;
                }
            } catch {}
        }

        try {
            const response = await fetch(remoteUrl, {
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });
            if (!response.ok) return false;
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
        } catch {
            return false;
        }
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