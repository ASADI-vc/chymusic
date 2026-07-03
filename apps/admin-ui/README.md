# CHYMUSIC Admin UI (Next.js)

Admin dashboard for curating scraped content, triggering scrapers, and exporting
the catalog. Only admins can access (JWT-gated).

## Pages

| Route         | Purpose                                                        |
| ------------- | ------------------------------------------------------------- |
| `/login`      | Sign in with admin credentials                                |
| `/dashboard`  | Overview stats + recent scrape jobs + top genres chart        |
| `/content`    | Browse, filter, curate, feature, hide, and delete content     |
| `/scrape`     | Trigger scraper jobs (musicsbaran, kashoob, RSS)              |
| `/curate`     | Visual home-screen curation (pick what users see first)       |
| `/settings`   | Trigger catalog JSON export                                   |

## Dev

```bash
pnpm install
pnpm dev:admin-ui
# → http://localhost:3000

# In a separate terminal, run the admin API:
pnpm dev:admin-api
# → http://localhost:8001
```

Default admin credentials are set in `services/admin-api/.env` — log in with those.

## Architecture

- Next.js App Router (15+)
- Server-side: API routes proxy to FastAPI via `next.config.mjs` rewrites
- Client-side: TanStack Query for data fetching, Zustand for auth state
- Styling: Tailwind CSS (dark theme matching the standalone PWA)
- Charts: Recharts for the dashboard genre distribution
