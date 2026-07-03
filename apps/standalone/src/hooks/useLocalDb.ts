/**
 * useLocalDb — initializes the local SQLite DB on app start.
 *
 * Returns a `ready` flag the app uses to gate rendering until the DB is open.
 */
import { useEffect, useState } from 'react';
import { getDb } from '@/lib/db';
import { syncCatalog } from '@/lib/catalog';

interface UseLocalDbState {
  ready: boolean;
  error: Error | null;
  catalogSynced: number;
}

export function useLocalDb(): UseLocalDbState {
  const [state, setState] = useState<UseLocalDbState>({
    ready: false,
    error: null,
    catalogSynced: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDb();
        if (cancelled) return;
        setState((s) => ({ ...s, ready: true }));
        // Sync catalog in the background — don't block UI.
        const count = await syncCatalog().catch((err) => {
          console.warn('[CHYMUSIC] Catalog sync failed:', err);
          return 0;
        });
        if (cancelled) return;
        setState((s) => ({ ...s, catalogSynced: count }));
      } catch (err) {
        if (cancelled) return;
        setState({ ready: true, error: err as Error, catalogSynced: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
