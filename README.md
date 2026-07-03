# CHYMUSIC

A modular, mostly-client-side music platform with a browser extension that caches
audio from any website to a user-chosen folder, a Spotify-style standalone PWA
with smart shuffle, and an admin back-office for scraping, cleaning, and curating
the home-screen catalog.

> **Status:** scaffold in progress. The original Blazor client lives on the
> [`legacyCHYMUSIC`](https://github.com/ASADI-vc/chymusic/tree/legacyCHYMUSIC)
> branch for reference.

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Edge / Brave)                                      │
│                                                                       │
│  ┌──────────────────┐      ┌────────────────────────────────────┐    │
│  │ CHYMUSIC         │      │ Standalone PWA (Vite + React)      │    │
│  │ Browser          │─────▶│  - JSON catalog loader             │    │
│  │ Extension (MV3)  │ msg  │  - Spotify-style UI                │    │
│  │                  │      │  - Smart shuffle (TF.js + heuristic)│    │
│  │ - Detects <audio>│      │  - SQLite (sql.js) local DB        │    │
│  │ - Asks permission│      │  - File System Access API cache    │    │
│  │ - Scrapes audio  │      │    + OPFS fallback                 │    │
│  │   + metadata     │      │  - 100% offline-capable PWA        │    │
│  └──────────────────┘      └────────────────────────────────────┘    │
│           │                              │                            │
│           │  writes files                │ reads catalog JSON         │
│           ▼                              ▼                            │
│  userSpecifiedFolder/CHYMUSIC/      (served by any static host)       │
│    ├── audio/                                                             │
│    ├── metadata.sqlite                                                    │
│    └── playlists.json                                                     │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ JSON catalog push (admin-curated)
                                  │
┌─────────────────────────────────┴───────────────────────────────────┐
│  Admin plane (private, admin-only)                                   │
│                                                                      │
│  ┌──────────────────────┐         ┌────────────────────────────┐    │
│  │ Admin UI (Next.js)   │  HTTP   │ Admin API (FastAPI, Python)│    │
│  │  - Login             │────────▶│  - Scrapers                │    │
│  │  - Data tables       │         │    (musicsbaran, kashoob,  │    │
│  │  - Category mgmt     │         │     custom)                │    │
│  │  - Home-screen       │         │  - Data cleaning pipeline  │    │
│  │    curation          │         │  - Catalog JSON export     │    │
│  │  - Analytics         │         │  - Auth (admin-only)       │    │
│  └──────────────────────┘         └────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Monorepo layout

```
chymusic/
├── apps/
│   ├── standalone/        # Vite + React PWA — the user-facing music app
│   ├── extension/         # Chrome MV3 extension — audio scraper + cache
│   └── admin-ui/          # Next.js admin dashboard (curators only)
├── services/
│   └── admin-api/         # FastAPI service — scrapers + cleaning + export
└── packages/
    └── shared/            # Shared TS types, schemas, constants
```

## Content types supported

| Type      | Sources                                                | Storage       |
| --------- | ------------------------------------------------------ | ------------- |
| Music     | musicsbaran.ir, user-scraped sites, user-uploaded     | audio file + metadata row |
| Podcast   | RSS feeds, user-scraped sites                          | audio file + metadata row |
| Madahi    | kashoob.com, other Noheh sites                         | audio file + metadata row |
| Speech    | user-scraped sites, user-uploaded                      | audio file + metadata row |

All four types share a flexible `Content` schema with a `kind` discriminator
(see [`docs/SCHEMA.md`](docs/SCHEMA.md)).

## Tech stack

| Component       | Stack                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Standalone PWA  | Vite + React 18 + TypeScript, vite-plugin-pwa, sql.js, TF.js          |
| Browser ext     | Chrome MV3, TypeScript, Vite, @crxjs/vite-plugin                      |
| Admin API       | Python 3.11+, FastAPI, SQLAlchemy 2, BeautifulSoup4, httpx            |
| Admin UI        | Next.js 16, React 19, TypeScript, TanStack Table, Tailwind CSS         |
| Shared package  | TypeScript, Zod schemas                                               |
| Package manager | pnpm workspaces                                                       |

## Quick start

```bash
# install everything
pnpm install

# run standalone + extension + admin UI in parallel
pnpm dev

# individual apps
pnpm dev:standalone
pnpm dev:extension
pnpm dev:admin-ui

# run admin API (Python)
cd services/admin-api
uv sync
uv run uvicorn app.main:app --reload --port 8001
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — component responsibilities, data flow, deployment
- [docs/SCHEMA.md](docs/SCHEMA.md) — content / track / artist / playlist schemas
- [docs/EXTENSION.md](docs/EXTENSION.md) — extension architecture, scraping protocol, permissions
- [docs/SMART_SHUFFLE.md](docs/SMART_SHUFFLE.md) — recommender algorithm design
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — branch model, commit conventions, code style

## Branch model

| Branch           | Purpose                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `main`           | Active development of the new architecture (this branch).         |
| `legacyCHYMUSIC` | Frozen snapshot of the original Blazor client. Reference only.    |

## License

MIT
