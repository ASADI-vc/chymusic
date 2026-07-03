# CHYMUSIC Browser Extension

This document describes the extension architecture, scraping protocol, and
security model in detail.

## Manifest V3 architecture

| Layer            | File                          | Purpose                                              |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| Content script   | `src/content/index.ts`        | Injected on every page; scans DOM for audio          |
| Background SW    | `src/background/index.ts`     | Receives detections, manages permissions, downloads  |
| Popup            | `src/popup/main.tsx`          | Shows detected audio on the current tab              |
| Options page     | `src/options/main.ts`         | Manage per-host permissions                          |
| External connect | `externally_connectable`      | Bidirectional messaging with the PWA                 |

## Permissions

| Permission         | Why                                                            |
| ------------------ | -------------------------------------------------------------- |
| `storage`          | Persist permissions + metadata queue                            |
| `downloads`        | Fallback: write audio to `~/Downloads/CHYMUSIC/audio/`          |
| `scripting`        | Inject content script on demand                                |
| `activeTab`        | Read the current tab for the popup                              |
| `tabs`             | Read tab URL + ID for per-tab badge                             |
| `notifications`    | Notify the user when audio is detected on a new host            |
| `host_permissions: <all_urls>` | Need to scan any site the user visits             |

We deliberately do **not** request `fileSystem` write access from the extension
context — the extension can't pick a folder the way the PWA can. Instead, the
extension delegates file writes to the PWA (via `externally_connectable`) when
the PWA is open, and falls back to `chrome.downloads` otherwise.

## Detection algorithm

`src/lib/detect.ts` runs `detectAudioOnPage()` on every page load and on every
debounced DOM mutation:

1. **`<audio>` elements**: collect `src` and `currentSrc`, plus all `<source>`
   children with their MIME types.
2. **`<video>` elements**: include only if their URL ends in a known audio
   extension (some sites use `<video>` for podcasts).
3. **`<a>` tags**: include any anchor whose `href` ends in `.mp3`, `.m4a`,
   `.aac`, `.ogg`, `.oga`, `.opus`, `.wav`, `.flac`, or `.webm`.
4. **Known sources**: for `musicsbaran.ir` and `kashoob.com`, run
   `scrapeKnownSource()` which uses site-specific CSS selectors to extract
   album title, artist, track list, and cover image. The result is merged with
   the generic detection.
5. **Metadata extraction**: best-effort guess of title (`aria-label`, `title`,
   link text), artist (from `og:description` or `h1`), and album (from
   `og:title`).

Each detected audio is sent as a `DETECT_AUDIO_RESULT` message to the
background service worker.

## Permission flow

```
Detection on new host
  → background checks hasPermission(host)
    → if yes: auto-queue all detected audio for caching
    → if no: chrome.notifications.create(...)
      → user clicks "Cache to my library"
        → grantPermission(host)
        → queue all detected audio on this host
        → permission persists for 30 days (configurable in @chymusic/shared)
      → user clicks "Not now"
        → notification dismissed, no permission stored
```

Permissions are stored in `chrome.storage.local` under the key
`chymusic:scrape-permissions` as an array of
`{ host, grantedAt, expiresAt }` records.

## Caching pipeline

```
queueCache(audio)
  ├─ already in queue? → return
  ├─ status = 'downloading', broadcast state
  ├─ try downloadViaPwa(audio):
  │    ├─ PWA port open?
  │    │   yes → postMessage(CACHE_AUDIO, audio)
  │    │         wait for CACHE_AUDIO_DONE or CACHE_AUDIO_ERROR
  │    │         (timeout: 5 min)
  │    │   no  → reject
  │    └─ on success: localPath returned by PWA
  ├─ catch → downloadViaChrome(audio):
  │    └─ chrome.downloads.download({ url, filename: 'CHYMUSIC/audio/...' })
  ├─ status = 'done', save metadata to chrome.storage.local
  └─ broadcast state
```

### Metadata queue

Cached audio metadata is queued in `chrome.storage.local` under
`chymusic:metadata-queue`. The PWA drains this queue on startup and upserts
into the local SQLite DB.

## PWA ↔ Extension messaging

The PWA connects to the extension via `chrome.runtime.connect(extensionId)`.
The extension's `externally_connectable.matches` controls which origins are
allowed:

```json
"externally_connectable": {
  "matches": [
    "http://localhost:*/*",
    "https://chymusic.app/*",
    "https://*.chymusic.app/*"
  ]
}
```

In development, the PWA runs on `http://localhost:5173` (Vite default). In
production, it should be hosted on `chymusic.app` (or a subdomain). To allow
a different origin, edit `apps/extension/manifest.config.ts`.

### Message types

See `src/lib/messages.ts` for the full discriminated union. Key flows:

- `PWA_REQUEST_STATE` → `STATE` — PWA polls for current detected audio + cache queue
- `PWA_CACHE_FROM_URL` → PWA asks the extension to cache a specific URL (e.g. user clicked "Cache" in the PWA UI)
- `CACHE_AUDIO` → `CACHE_AUDIO_PROGRESS` → `CACHE_AUDIO_DONE` / `CACHE_AUDIO_ERROR` — bidirectional during a single download

## Security

- The extension only writes to `~/Downloads/CHYMUSIC/` (via `chrome.downloads`)
  or to the PWA's user-chosen folder (via FSA, delegated through the PWA).
- The extension never executes scraped HTML.
- The extension never sends data to the admin API without an explicit user opt-in
  in the PWA Settings (which sets the API key).
- The `externally_connectable` allowlist prevents random websites from
  impersonating the PWA.

## Adding a new known source

1. Add an entry to `KNOWN_SOURCES` in `packages/shared/src/constants/index.ts`:
   ```ts
   'mysite.com': {
     name: 'MySite',
     kind: 'music',
     selectors: {
       albumTitle: 'h1.entry-title',
       albumArtist: '.artist',
       trackList: '.tracks li',
       trackTitle: '.title',
       trackDownloadUrl: 'a.download',
       coverImage: '.cover img',
     },
   },
   ```
2. The extension will automatically use these selectors when scanning
   `mysite.com`. No other code changes needed.
3. To also scrape the site from the admin API, add a scraper class in
   `services/admin-api/app/scrapers/` and register it in `REGISTRY`.
