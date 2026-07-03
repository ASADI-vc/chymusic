# CHYMUSIC Browser Extension (Chrome MV3)

Detects audio on any website you visit, asks if you want to cache it to your
CHYMUSIC library, and writes metadata for the standalone PWA to consume.

## What it does

1. **Detects audio** on every page load: `<audio>`, `<video>`, and `<a>` tags
   pointing to audio files.
2. **Asks once per host**: when audio is first detected on a new site, you get
   a Chrome notification asking whether to cache. Grant once → all future audio
   on that host is cached automatically.
3. **Downloads audio** to your CHYMUSIC folder:
   - If the standalone PWA is open and connected (via `externally_connectable`),
     the PWA receives the audio and writes it to your chosen folder via the
     File System Access API.
   - Otherwise, falls back to `chrome.downloads` → `~/Downloads/CHYMUSIC/audio/`.
4. **Writes metadata** to `chrome.storage.local`. The PWA syncs this on next
   open and upserts into the local SQLite DB.

## Known sources

| Site             | Kind    | Notes                                           |
| ---------------- | ------- | ----------------------------------------------- |
| musicsbaran.ir   | music   | Persian music, uses site-specific selectors      |
| kashoob.com      | madahi  | Noheh, uses site-specific selectors              |

Other sites use generic detection (any audio MIME type or extension).

## Dev

```bash
pnpm install
pnpm dev:extension    # builds with --watch into dist/
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select `apps/extension/dist/`

## Architecture

See [../../docs/EXTENSION.md](../../docs/EXTENSION.md) for the full scraping
protocol, messaging schema, and security model.
