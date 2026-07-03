/**
 * File System Access — hybrid (FSA + OPFS fallback).
 *
 * The user picks a folder on their system via `window.showDirectoryPicker()`.
 * All audio files, cover images, and the SQLite DB live under
 * `<userFolder>/CHYMUSIC/{audio,covers,metadata,...}`.
 *
 * On browsers that don't support the File System Access API (Firefox, Safari),
 * we transparently fall back to OPFS (Origin Private File System) — the user
 * still gets persistent storage, just inside the browser sandbox.
 */
import { get, set } from 'idb-keyval';
import { CHYMUSIC_FOLDER_NAME, SUBFOLDERS } from '@chymusic/shared';

const IDB_KEY = 'chymusic:fsa-root';

export type StorageBackend = 'fsa' | 'opfs' | 'none';

export interface StorageHandle {
  backend: StorageBackend;
  /** Human-readable description for the settings page. */
  description: string;
  /** Root directory handle (FSA) or null (OPFS). */
  rootDir: FileSystemDirectoryHandle | null;
  /** Subfolder handles, lazily created on demand. */
  getSubfolder(name: string): Promise<FileSystemDirectoryHandle>;
  /** Write a file to a subfolder. */
  writeFile(subfolder: string, filename: string, data: Blob | ArrayBuffer | string): Promise<string>;
  /** Read a file from a subfolder. Returns null if missing. */
  readFile(subfolder: string, filename: string): Promise<Blob | null>;
  /** Delete a file from a subfolder. */
  deleteFile(subfolder: string, filename: string): Promise<void>;
  /** Check if a file exists. */
  exists(subfolder: string, filename: string): Promise<boolean>;
  /** List files in a subfolder. */
  listFiles(subfolder: string): Promise<string[]>;
}

const PERMISSION_KEY = 'chymusic:fsa-permission';

function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'getDirectory' in navigator.storage
  );
}

class FsaStorage implements StorageHandle {
  backend = 'fsa' as const;
  rootDir: FileSystemDirectoryHandle;
  private subfolders = new Map<string, FileSystemDirectoryHandle>();

  constructor(rootDir: FileSystemDirectoryHandle) {
    this.rootDir = rootDir;
  }

  get description(): string {
    return `Local folder: ${this.rootDir.name}/CHYMUSIC`;
  }

  async getSubfolder(name: string): Promise<FileSystemDirectoryHandle> {
    const cached = this.subfolders.get(name);
    if (cached) return cached;

    const chyDir = await this.rootDir.getDirectoryHandle(CHYMUSIC_FOLDER_NAME, { create: true });
    const sub = await chyDir.getDirectoryHandle(name, { create: true });
    this.subfolders.set(name, sub);
    return sub;
  }

  async writeFile(
    subfolder: string,
    filename: string,
    data: Blob | ArrayBuffer | string,
  ): Promise<string> {
    const dir = await this.getSubfolder(subfolder);
    const file = await dir.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(data);
    await writable.close();
    return `${subfolder}/${filename}`;
  }

  async readFile(subfolder: string, filename: string): Promise<Blob | null> {
    try {
      const dir = await this.getSubfolder(subfolder);
      const file = await dir.getFileHandle(filename);
      return await file.getFile();
    } catch {
      return null;
    }
  }

  async deleteFile(subfolder: string, filename: string): Promise<void> {
    const dir = await this.getSubfolder(subfolder);
    await dir.removeEntry(filename);
  }

  async exists(subfolder: string, filename: string): Promise<boolean> {
    try {
      const dir = await this.getSubfolder(subfolder);
      await dir.getFileHandle(filename);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(subfolder: string): Promise<string[]> {
    const dir = await this.getSubfolder(subfolder);
    const names: string[] = [];
    // @ts-expect-error: values() is part of the FS Access API spec.
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') names.push(entry.name);
    }
    return names;
  }
}

class OpfsStorage implements StorageHandle {
  backend = 'opfs' as const;
  rootDir: FileSystemDirectoryHandle | null = null;
  private chyDir: FileSystemDirectoryHandle | null = null;
  private subfolders = new Map<string, FileSystemDirectoryHandle>();

  constructor() {
    // Lazy-init in getChyDir()
  }

  get description(): string {
    return 'Browser private storage (OPFS) — files are not visible in your file explorer.';
  }

  private async getChyDir(): Promise<FileSystemDirectoryHandle> {
    if (this.chyDir) return this.chyDir;
    if (!isOpfsSupported()) {
      throw new Error('Neither File System Access API nor OPFS is supported in this browser.');
    }
    const root = await navigator.storage.getDirectory();
    this.chyDir = await root.getDirectoryHandle(CHYMUSIC_FOLDER_NAME, { create: true });
    return this.chyDir;
  }

  async getSubfolder(name: string): Promise<FileSystemDirectoryHandle> {
    const cached = this.subfolders.get(name);
    if (cached) return cached;
    const chyDir = await this.getChyDir();
    const sub = await chyDir.getDirectoryHandle(name, { create: true });
    this.subfolders.set(name, sub);
    return sub;
  }

  async writeFile(
    subfolder: string,
    filename: string,
    data: Blob | ArrayBuffer | string,
  ): Promise<string> {
    const dir = await this.getSubfolder(subfolder);
    const file = await dir.getFileHandle(filename, { create: true });
    // OPFS supports createWritable via the synchronous access handle in workers,
    // but from the main thread we use the async writable stream.
    const writable = await (file as unknown as {
      createWritable: () => Promise<FileSystemWritableFileStream>;
    }).createWritable();
    await writable.write(data);
    await writable.close();
    return `${subfolder}/${filename}`;
  }

  async readFile(subfolder: string, filename: string): Promise<Blob | null> {
    try {
      const dir = await this.getSubfolder(subfolder);
      const file = await dir.getFileHandle(filename);
      return await file.getFile();
    } catch {
      return null;
    }
  }

  async deleteFile(subfolder: string, filename: string): Promise<void> {
    const dir = await this.getSubfolder(subfolder);
    await dir.removeEntry(filename);
  }

  async exists(subfolder: string, filename: string): Promise<boolean> {
    try {
      const dir = await this.getSubfolder(subfolder);
      await dir.getFileHandle(filename);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(subfolder: string): Promise<string[]> {
    const dir = await this.getSubfolder(subfolder);
    const names: string[] = [];
    // @ts-expect-error: values() is part of the OPFS API.
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') names.push(entry.name);
    }
    return names;
  }
}

let currentHandle: StorageHandle | null = null;

export function getCurrentStorage(): StorageHandle | null {
  return currentHandle;
}

/**
 * Ask the user to pick a folder. Falls back to OPFS if FSA is unavailable.
 * Persists the handle to IndexedDB so we can re-request permission on next visit.
 */
export async function pickStorageFolder(): Promise<StorageHandle> {
  if (isFsaSupported()) {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      const handle = new FsaStorage(dir);
      currentHandle = handle;
      // Persist handle for re-grant on next session.
      await set(IDB_KEY, dir);
      return handle;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        throw err; // User cancelled.
      }
      console.warn('[CHYMUSIC] FSA picker failed, falling back to OPFS:', err);
    }
  }

  // Fallback: OPFS.
  const opfs = new OpfsStorage();
  currentHandle = opfs;
  return opfs;
}

/**
 * Try to restore a previously-granted FSA handle (without showing the picker).
 * Returns null if permission was revoked or no handle was saved.
 */
export async function tryRestoreStorage(): Promise<StorageHandle | null> {
  if (currentHandle) return currentHandle;

  if (isFsaSupported()) {
    const saved = await get(IDB_KEY);
    if (saved) {
      const perm = await (saved as FileSystemDirectoryHandle).queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        currentHandle = new FsaStorage(saved as FileSystemDirectoryHandle);
        return currentHandle;
      }
      // Try to request silently (Chrome will show a one-time popup).
      const req = await (saved as FileSystemDirectoryHandle).requestPermission({ mode: 'readwrite' });
      if (req === 'granted') {
        currentHandle = new FsaStorage(saved as FileSystemDirectoryHandle);
        return currentHandle;
      }
    }
  }

  if (isOpfsSupported()) {
    currentHandle = new OpfsStorage();
    return currentHandle;
  }

  return null;
}
