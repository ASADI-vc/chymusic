import { useEffect, useState } from 'react';
import { query } from '@/lib/db';
import { tryRestoreStorage, pickStorageFolder, getCurrentStorage } from '@/lib/storage';
import type { StorageHandle } from '@/lib/storage';
import { syncCatalog } from '@/lib/catalog';

export function SettingsPage() {
  const [storage, setStorage] = useState<StorageHandle | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState<number | null>(null);

  useEffect(() => {
    tryRestoreStorage().then(setStorage).catch(console.warn);
  }, []);

  const handlePickFolder = async () => {
    try {
      const handle = await pickStorageFolder();
      setStorage(handle);
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.warn('[CHYMUSIC] Folder pick failed:', err);
      }
    }
  };

  const handleSyncCatalog = async () => {
    setSyncing(true);
    try {
      const count = await syncCatalog();
      setSyncCount(count);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page__title">Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section__title">Storage</h2>
        <p className="settings-section__desc">
          Choose where CHYMUSIC stores cached audio, metadata, and playlists on your system.
          On Chrome/Edge, you can pick a real folder on disk. On Firefox/Safari, we fall back
          to in-browser private storage (OPFS).
        </p>
        <div className="settings-section__status">
          <strong>Current:</strong> {storage?.description ?? 'Not configured'}
          <span className="settings-section__backend">{storage?.backend ?? 'none'}</span>
        </div>
        <button onClick={handlePickFolder} className="settings-section__btn">
          {storage ? 'Change folder' : 'Pick folder'}
        </button>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Catalog</h2>
        <p className="settings-section__desc">
          The catalog is the JSON dataset published by the admin server. Syncing downloads
          all catalog pages and upserts them into the local SQLite database.
        </p>
        <button onClick={handleSyncCatalog} disabled={syncing} className="settings-section__btn">
          {syncing ? 'Syncing…' : 'Sync catalog now'}
        </button>
        {syncCount !== null && (
          <p className="settings-section__status">Synced {syncCount} items.</p>
        )}
      </section>

      <style>{`
        .settings-section {
          background: rgba(255,255,255,0.03);
          padding: 20px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .settings-section__title {
          font-size: 16px;
          font-weight: 600;
        }
        .settings-section__desc {
          font-size: 13px;
          color: var(--chy-fg-muted);
          line-height: 1.5;
        }
        .settings-section__status {
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .settings-section__backend {
          font-size: 10px;
          text-transform: uppercase;
          background: var(--chy-hover);
          padding: 2px 8px;
          border-radius: 10px;
          color: var(--chy-fg-muted);
        }
        .settings-section__btn {
          align-self: flex-start;
          background: var(--chy-accent);
          color: #000;
          border: none;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 120ms, transform 120ms;
        }
        .settings-section__btn:hover:not(:disabled) {
          background: var(--chy-accent-hover);
          transform: scale(1.02);
        }
        .settings-section__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
