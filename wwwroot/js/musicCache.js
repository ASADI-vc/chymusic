window.musicCache = (() => {
    const memoryUrls = new Map();
    let directoryHandle = null;
    const manifestName = "manifest.json";

    // ---------- File System Access utilities ----------
    function isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window;
    }

    async function getSetting(key) {
        // We use a small IndexedDB for storing the directory handle only
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("musicweb-settings", 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "key" });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction("settings", "readonly");
                const req = tx.objectStore("settings").get(key);
                req.onsuccess = () => resolve(req.result?.value ?? null);
                req.onerror = () => reject(req.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async function setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("musicweb-settings", 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "key" });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction("settings", "readwrite");
                tx.objectStore("settings").put({ key, value });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            request.onerror = () => reject(request.error);
        });
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
            if (err.name === 'AbortError') console.log('User cancelled.');
            else console.error('Folder error:', err);
        }
        return false;
    }

    function isFolderAccessGranted() {
        return directoryHandle !== null;
    }

    function sanitizeFilename(name) {
        return name.replace(/[/\\?%*:|"<>]/g, '-');
    }

    // ---------- Filename helpers ----------
    function getOriginalName(proxyUrl) {
        if (proxyUrl && proxyUrl.includes('/proxy.php?url=')) {
            const queryString = proxyUrl.split('?url=')[1];
            if (queryString) {
                const decoded = decodeURIComponent(queryString);
                const parts = decoded.split('/');
                let name = parts.pop() || '';
                if (!name.includes('.')) name += '.mp3';
                return sanitizeFilename(name);
            }
        }
        const parts = proxyUrl.split('/');
        let name = parts.pop() || '';
        if (!name.includes('.')) name += '.mp3';
        return sanitizeFilename(name);
    }

    function getUniqueFilename(id, proxyUrl) {
        return `${id}_${getOriginalName(proxyUrl)}`;
    }

    // ---------- Manifest (JSON file in folder) ----------
    async function readManifest() {
        if (!directoryHandle) return {};
        try {
            const fileHandle = await directoryHandle.getFileHandle(manifestName, { create: false });
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch {
            return {};
        }
    }

    async function writeManifest(manifest) {
        if (!directoryHandle) return;
        try {
            const fileHandle = await directoryHandle.getFileHandle(manifestName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(manifest));
            await writable.close();
        } catch (err) {
            console.warn('Manifest write failed:', err);
        }
    }

    async function addToManifest(id, filename, size = 0) {
        const manifest = await readManifest();
        manifest[id] = { filename, size };
        await writeManifest(manifest);
    }

    // ---------- Public API ----------

    /**
     * Returns a playable URL only if the file exists on disk.
     * No IndexedDB, no in‑browser caching.
     */
    async function getPlayableUrl(id, remoteUrl) {
        if (memoryUrls.has(id)) {
            return memoryUrls.get(id);
        }

        if (!directoryHandle || !remoteUrl) return null;

        try {
            const manifest = await readManifest();
            const uniqueName = getUniqueFilename(id, remoteUrl);
            let fileHandle = null;

            // 1. Manifest entry
            if (manifest[id]?.filename) {
                try {
                    fileHandle = await directoryHandle.getFileHandle(manifest[id].filename, { create: false });
                } catch {}
            }
            // 2. Unique name
            if (!fileHandle) {
                try {
                    fileHandle = await directoryHandle.getFileHandle(uniqueName, { create: false });
                } catch {}
            }

            if (fileHandle) {
                const file = await fileHandle.getFile();
                if (!manifest[id]) {
                    await addToManifest(id, uniqueName, file.size);
                }
                const url = URL.createObjectURL(file);
                memoryUrls.set(id, url);
                return url;
            }
        } catch (err) {
            console.warn('getPlayableUrl error:', err);
        }

        return null;
    }

    /**
     * Download and save to folder only. No in‑browser blob storage.
     */
    async function prefetchTrack(id, proxyUrl) {
        if (!directoryHandle) return false;

        // Check if already on disk
        try {
            const manifest = await readManifest();
            const uniqueName = getUniqueFilename(id, proxyUrl);
            let fileHandle = null;

            if (manifest[id]?.filename) {
                try { fileHandle = await directoryHandle.getFileHandle(manifest[id].filename, { create: false }); } catch {}
            }
            if (!fileHandle) {
                try { fileHandle = await directoryHandle.getFileHandle(uniqueName, { create: false }); } catch {}
            }

            if (fileHandle) {
                if (!manifest[id]) {
                    const file = await fileHandle.getFile();
                    await addToManifest(id, uniqueName, file.size);
                }
                return true;
            }
        } catch {}

        // Download from network (proxy URL) and save to folder
        try {
            const response = await fetch(proxyUrl, {
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });
            if (!response.ok) return false;

            const blob = await response.blob();
            const uniqueName = getUniqueFilename(id, proxyUrl);
            const fileHandle = await directoryHandle.getFileHandle(uniqueName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            await addToManifest(id, uniqueName, blob.size);

            // Also keep in memory for immediate playback
            memoryUrls.set(id, URL.createObjectURL(blob));
            return true;
        } catch (err) {
            console.warn('Prefetch failed:', err);
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