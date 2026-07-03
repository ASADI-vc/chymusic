# CHYMUSIC Admin API (FastAPI)

The admin back-office service for CHYMUSIC. Runs separately from the standalone
PWA. Admin UI talks to this; end users never do.

## What it does

- **Scrapers**: musicsbaran, kashoob, RSS feeds. Site-specific selectors live in `app/scrapers/`.
- **Cleaning**: trims whitespace, validates URLs, strips HTML, normalizes genres.
- **Classifier**: heuristic-based genre normalization (mirrors the PWA's rules).
- **Catalog export**: writes paginated JSON to `data/exports/catalog/page-N.json`,
  which the standalone PWA fetches.
- **Extension ingest**: receives scraped audio pushed from the browser extension
  (only if the user opts in via the PWA Settings).
- **Auth**: JWT bearer tokens, admin-only. Bootstrap user is created on first run.

## Quickstart

```bash
cd services/admin-api

# Install with uv (recommended)
uv sync
cp .env.example .env       # then edit .env to set JWT_SECRET and ADMIN_PASSWORD
uv run uvicorn app.main:app --reload --port 8001

# Or with pip
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8001
```

Default admin credentials are in `.env` — change them on first login.

## API reference

Once running, open `http://localhost:8001/docs` for the interactive OpenAPI spec.

Key endpoints:

| Method | Path                          | Purpose                                          |
| ------ | ----------------------------- | ------------------------------------------------ |
| POST   | `/api/v1/auth/login`          | Login → JWT                                      |
| GET    | `/api/v1/auth/me`             | Current user info                                |
| GET    | `/api/v1/content`             | List content (filter by kind/source/curated/...)  |
| POST   | `/api/v1/content`             | Create content manually                          |
| PATCH  | `/api/v1/content/{id}`        | Update content (curate, feature, hide, etc.)     |
| DELETE | `/api/v1/content/{id}`        | Delete content                                   |
| GET    | `/api/v1/content/stats`       | Aggregated stats for the admin dashboard         |
| POST   | `/api/v1/scrape`              | Trigger a scraper (returns job ID)               |
| GET    | `/api/v1/scrape/{job_id}`     | Poll scraper status                              |
| GET    | `/api/v1/scrape`              | List recent scrape jobs                          |
| POST   | `/api/v1/catalog/export`      | Regenerate catalog JSON pages                    |
| GET    | `/api/v1/catalog/manifest.json` | Public: catalog metadata (page count, etc.)    |
| GET    | `/api/v1/catalog/page-{n}.json` | Public: a single catalog page                   |
| POST   | `/api/v1/ingest`              | Extension pushes scraped audio (API-key auth)    |
