# Contributing to CHYMUSIC

## Branch model

| Branch           | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `main`           | Active development of the new architecture                    |
| `legacyCHYMUSIC` | Frozen snapshot of the original Blazor client (reference only)|

For new work:
1. Branch from `main`: `git checkout -b feat/your-feature`
2. Open a PR against `main`
3. Squash-merge on approval

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructure without behavior change
- `perf` — performance improvement
- `docs` — documentation only
- `test` — test additions or corrections
- `chore` — build, tooling, dependencies
- `ci` — CI/CD changes

**Scopes:**
- `standalone` — apps/standalone
- `extension` — apps/extension
- `admin-ui` — apps/admin-ui
- `admin-api` — services/admin-api
- `shared` — packages/shared
- `docs` — docs/
- `repo` — monorepo-level (root package.json, .gitignore, etc.)

**Examples:**
```
feat(standalone): add smart shuffle engine
fix(extension): handle AbortError when user cancels folder picker
docs(schema): document Content.source enum
chore(repo): bump pnpm to 9.12.0
```

## Code style

### TypeScript / JavaScript
- Prettier with config from `.prettierrc` (single quotes, trailing commas, 100 char width)
- ESLint with `next/core-web-vitals` for Next.js apps
- Strict TypeScript everywhere (`strict: true`, `noUncheckedIndexedAccess: true` where applicable)
- Prefer `type` imports for types: `import type { Content } from '@chymusic/shared'`

### Python
- Ruff (line length 100, rules in `pyproject.toml`)
- Type hints required on all public functions
- Pydantic for all API schemas

### Shared schemas
- All cross-component data shapes live in `packages/shared/src/types/index.ts`
- Zod schemas in `packages/shared/src/schemas/index.ts` must mirror the types
- The FastAPI admin API's Pydantic schemas in `services/admin-api/app/schemas/`
  must mirror the shared types
- When updating a schema, update all three places in the same commit

## Testing

- **Standlone PWA**: Vitest (planned)
- **Extension**: Vitest (planned)
- **Admin UI**: Jest / React Testing Library (planned)
- **Admin API**: pytest (planned)

For now, focus on type-safety and manual smoke tests. Test infrastructure is
a TODO.

## Local dev setup

```bash
# Install all workspace dependencies
pnpm install

# Run everything in parallel (terminal 1)
pnpm dev

# Run admin API (terminal 2)
cd services/admin-api
uv sync
cp .env.example .env  # edit secrets
uv run uvicorn app.main:app --reload --port 8001

# Load the extension in Chrome
# 1. pnpm dev:extension
# 2. chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```

## Adding a new content source

1. Add the source literal to `ContentSource` in:
   - `packages/shared/src/types/index.ts`
   - `packages/shared/src/schemas/index.ts`
   - `services/admin-api/app/schemas/content.py`
2. If the source has a known default kind/genre, add it to:
   - `SOURCE_DEFAULTS` in `apps/standalone/src/lib/classifier.ts`
   - `SOURCE_DEFAULTS` in `services/admin-api/app/services/classifier.py`
3. If the source needs site-specific scraping selectors, add it to
   `KNOWN_SOURCES` in `packages/shared/src/constants/index.ts`.
4. If the source should be scrapeable from the admin API, write a scraper class
   in `services/admin-api/app/scrapers/` and register it in `REGISTRY`.
5. Run the full type-check to catch anything you missed:
   ```bash
   pnpm typecheck
   cd services/admin-api && uv run mypy app/
   ```

## Adding a new content kind

1. Add the kind literal to `ContentKind` in:
   - `packages/shared/src/types/index.ts`
   - `packages/shared/src/schemas/index.ts`
   - `services/admin-api/app/schemas/content.py`
2. Update the kind-to-default-genre map in both classifiers
   (`apps/standalone/src/lib/classifier.ts` and
   `services/admin-api/app/services/classifier.py`).
3. Add UI labels in:
   - `apps/standalone/src/pages/SearchPage.tsx` (kind badge)
   - `apps/admin-ui/src/app/(admin)/content/page.tsx` (filter dropdown)
4. The SQLite schema in `apps/standalone/src/lib/db.ts` stores `kind` as TEXT,
   so no migration is needed.
5. The SQLAlchemy model in `services/admin-api/app/models/content.py` uses
   `String(16)` for `kind`, so no migration is needed there either.
