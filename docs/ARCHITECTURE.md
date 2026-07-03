# CHYMUSIC Architecture

This document describes the four components of CHYMUSIC, how they communicate,
and how data flows through the system.

## Components

### 1. Standalone PWA (`apps/standalone`)

**Stack:** Vite + React 18 + TypeScript, vite-plugin-pwa, sql.js, TF.js

**Runs:** In the user's browser, hosted as a static site (any CDN, GitHub Pages,
or self-hosted). No backend of its own.

**Responsibilities:**
- Loads the catalog (JSON) from the admin API's public endpoints.
- Stores the catalog in a local SQLite DB (sql.js, persisted to OPFS).
- Plays audio via HTML5 `<audio>`, with caching to a user-chosen folder
  (File System Access API) or OPFS fallback.
- Computes a smart-shuffle queue client-side based on the user's listening
  history (stored as `PlayEvent` rows in the local DB).
- Classifies new audio (extension-scraped or user-uploaded) using a hybrid
  heuristic + TF.js model.

**Why Vite + React (not Next.js)?**
The standalone PWA must run 100% client-side. Next.js forces you to opt into
static export mode and gives you nothing in return that Vite doesn't. Vite is
faster to dev, has better PWA tooling via `vite-plugin-pwa`, and produces
smaller bundles.

### 2. Browser Extension (`apps/extension`)

**Stack:** Chrome MV3, TypeScript, @crxjs/vite-plugin

**Runs:** In Chrome/Edge/Brave, on every page the user visits.

**Responsibilities:**
- Content script scans the page for `<audio>`, `<video>`, and `<a>` tags
  pointing to audio MIME types or extensions.
- On first detection per host, shows a Chrome notification asking for
  permission to cache.
- On permission grant, automatically queues all detected audio for download.
- Background service worker downloads each audio file:
  - If the PWA is open and connected via `externally_connectable`, delegates
    the file write to the PWA (which uses the File System Access API to write
    to the user's chosen folder).
  - Otherwise, falls back to `chrome.downloads` → `~/Downloads/CHYMUSIC/audio/`.
- Writes metadata to `chrome.storage.local` so the PWA can sync on next open.

### 3. Admin API (`services/admin-api`)

**Stack:** Python 3.11+, FastAPI, SQLAlchemy 2, BeautifulSoup4, httpx

**Runs:** On a private server (admin-only, never exposed to end users).

**Responsibilities:**
- Site-specific scrapers for musicsbaran.ir, kashoob.com, and RSS feeds.
- Data cleaning pipeline (whitespace, URL validation, HTML sanitization).
- Heuristic genre classifier (mirrors the PWA's rules).
- Catalog JSON exporter — writes paginated `page-N.json` files the PWA fetches.
- Extension ingest endpoint — accepts scraped audio pushed from the user's
  browser extension (only if they opt in via PWA Settings).
- JWT-based admin auth with a bootstrap superadmin user.

### 4. Admin UI (`apps/admin-ui`)

**Stack:** Next.js 15+, React 19, TypeScript, TanStack Query/Table, Tailwind

**Runs:** On a private server (admin-only).

**Responsibilities:**
- JWT-gated login.
- Dashboard: content stats, top genres chart, recent scrape jobs.
- Content browser: filter by kind/source/curated/featured, with inline actions
  (feature, hide, delete, edit genre).
- Scraper trigger UI: pick scraper, set max_items, monitor job progress.
- Home-screen curation: visual grid for picking what shows up first in the PWA.
- Catalog export trigger.

## Data flow

### Catalog → PWA (the happy path)

```
Admin UI                 Admin API                          PWA
   │                        │                                │
   │  POST /scrape          │                                │
   ├───────────────────────▶│                                │
   │                        │ runs scraper                   │
   │                        │ cleans + classifies            │
   │                        │ writes to DB                   │
   │                        │                                │
   │  POST /catalog/export  │                                │
   ├───────────────────────▶│                                │
   │                        │ writes page-N.json             │
   │                        │ writes manifest.json           │
   │                        │                                │
   │                        │     GET /catalog/manifest.json │
   │                        │◀───────────────────────────────┤
   │                        │     GET /catalog/page-1.json   │
   │                        │◀───────────────────────────────┤
   │                        │     GET /catalog/page-2.json   │
   │                        │◀───────────────────────────────┤
   │                        │              ...               │
   │                        │                                │
   │                        │                  upserts into  │
   │                        │                  local SQLite  │
   │                        │                                │
```

### Audio detection → user folder

```
User visits site           Extension content script          Background SW          PWA
   │                                │                           │                  │
   │  page load                     │                           │                  │
   ├───────────────────────────────▶│                           │                  │
   │                                │ detects <audio>           │                  │
   │                                │ sendMessage(DETECT)       │                  │
   │                                ├──────────────────────────▶│                  │
   │                                │                           │ hasPermission?   │
   │                                │                           │   NO → notify    │
   │  notification "Allow cache?"   │                           │                  │
   │◀───────────────────────────────────────────────────────────┤                  │
   │  click "Allow"                 │                           │                  │
   ├───────────────────────────────────────────────────────────▶│                  │
   │                                │                           │ grantPermission()│
   │                                │                           │ queueCache(...)  │
   │                                │                           │                  │
   │                                │                           │ PWA connected?   │
   │                                │                           │   YES → postMessage(CACHE_AUDIO)│
   │                                │                           ├─────────────────▶│
   │                                │                           │                  │ fetch audio
   │                                │                           │                  │ write to userFolder/CHYMUSIC/audio/
   │                                │                           │                  │ upsert into local SQLite
   │                                │                           │                  │ postMessage(CACHE_AUDIO_DONE)
   │                                │                           │◀─────────────────┤
   │                                │                           │ saveMetadata()   │
   │                                │                           │                  │
```

### Smart shuffle

```
User plays track           PWA                                               
   │                        │                                                
   ├───────────────────────▶│                                                
   │                        │ INSERT INTO play_event(...)                    
   │                        │ recompute listening_profile (debounced)        
   │                        │                                                
   │   track ends           │                                                
   ├───────────────────────▶│                                                
   │                        │ smartShuffle({ current, profile, history })    
   │                        │   score every candidate                        
   │                        │   softmax sample N tracks                      
   │                        │ append to queue                                
   │   next track starts    │                                                
   │◀───────────────────────┤                                                
```

## Security model

| Boundary             | Auth                                              |
| -------------------- | ------------------------------------------------- |
| Admin UI → Admin API | JWT bearer token (admin login)                    |
| PWA → Admin API      | None — only public catalog endpoints are reachable |
| Extension → Admin API | API key (`X-CHYMUSIC-API-Key` header, ingest only) |
| Extension → PWA      | `externally_connectable` matches trusted origins  |
| PWA → Extension      | Same as above (bidirectional Port)                |

The standalone PWA never holds admin credentials. It only reads public catalog
JSON. If the user opts in to push extension-scraped audio back to the admin
server, that push goes through the extension's API-key-authenticated endpoint,
not the PWA.

## Deployment

| Component    | Suggested host                                    |
| ------------ | ------------------------------------------------- |
| Standalone PWA | Any static host: Cloudflare Pages, Vercel, GitHub Pages |
| Extension    | Chrome Web Store (or unpacked for dev)            |
| Admin API    | Private VPS behind VPN/Tailscale, or Cloud Run with IAM |
| Admin UI     | Same as Admin API (or co-located as static export) |

## Branching strategy

- `main` — active development of the new architecture
- `legacyCHYMUSIC` — frozen snapshot of the original Blazor client (reference)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions and code style.
