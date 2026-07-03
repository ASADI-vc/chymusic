# CHYMUSIC standalone PWA

The user-facing music client. 100% client-side (no backend), PWA, smart shuffle.

## Stack
- Vite + React 18 + TypeScript
- vite-plugin-pwa (service worker + manifest)
- sql.js (SQLite in WASM, persisted to OPFS)
- File System Access API with OPFS fallback (audio file cache)
- TF.js + heuristic hybrid genre classifier
- Zustand (state), TanStack Query (catalog sync), lucide-react (icons)

## Dev

```bash
pnpm install   # from monorepo root
pnpm dev:standalone
# → http://localhost:5173
```

## Architecture

See [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for component-level
data flow. Key modules:

| File                          | Responsibility                                   |
| ----------------------------- | ------------------------------------------------ |
| `src/lib/db.ts`               | sql.js SQLite init, schema, query/run helpers    |
| `src/lib/storage.ts`          | FSA + OPFS hybrid storage abstraction            |
| `src/lib/catalog.ts`          | JSON catalog fetcher → SQLite upserts            |
| `src/lib/smartShuffle.ts`     | Genre/artist/history-weighted recommender        |
| `src/lib/classifier.ts`       | Heuristic + TF.js genre classifier               |
| `src/store/playerStore.ts`    | Zustand player state (queue, current, controls)  |
| `src/components/AppLayout.tsx`| Sidebar + main + player-bar shell                |
| `src/components/PlayerBar.tsx`| Bottom playback controls (Spotify-style)         |
