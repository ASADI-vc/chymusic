# CHYMUSIC Schema

This document describes the data model shared across all four components. The
authoritative source is `packages/shared/src/types/index.ts` (TypeScript) and
`packages/shared/src/schemas/index.ts` (Zod schemas for runtime validation).
The FastAPI admin API mirrors the same shapes in Python (Pydantic).

## Content

The central entity. Stored in:
- `content` table in the PWA's local SQLite DB (`apps/standalone/src/lib/db.ts`)
- `content` table in the admin API's SQLAlchemy DB (`services/admin-api/app/models/content.py`)
- Each `items[]` entry in `data/exports/catalog/page-N.json`

### Discriminator: `kind`

| Value      | Description                                 |
| ---------- | ------------------------------------------- |
| `music`    | A song, instrumental, or audio track        |
| `podcast`  | A podcast episode                           |
| `madahi`   | A Noheh / Madahi track (from kashoob etc.)  |
| `speech`   | A speech, lecture, khutbah, or talk         |

The schema is intentionally flexible: to add a new kind (e.g. `audiobook`),
you only need to add the literal to the union in both TypeScript and Pydantic.
No migration required.

### Sources

| Value               | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `musicsbaran`       | Scraped from musicsbaran.ir by the admin API               |
| `kashoob`           | Scraped from kashoob.com by the admin API                  |
| `extension_scrape`  | Scraped by the user's browser extension from any site      |
| `user_upload`       | Uploaded by the user from their filesystem                 |
| `admin_import`      | Manually imported by an admin via the admin UI             |
| `rss_feed`          | Pulled from a podcast RSS feed                             |

### Fields

| Field                  | Type              | Required | Description                                |
| ---------------------- | ----------------- | -------- | ------------------------------------------ |
| `id`                   | UUID v4           | yes      | Stable across all components                |
| `kind`                 | ContentKind       | yes      | music / podcast / madahi / speech          |
| `title`                | string            | yes      | Original-language title                     |
| `titleRomanized`       | string?           | no       | Transliterated title                        |
| `subtitle`             | string?           | no       | "feat. X", "Episode 5", etc.               |
| `artist`               | string            | yes      | Primary artist/performer/speaker            |
| `artists`              | string[]?         | no       | Additional contributors                     |
| `album`                | string?           | no       | Album / podcast series / Noheh album        |
| `coverImageUrl`        | URL?              | no       | Cover art (relative or absolute)            |
| `backdropImageUrl`     | URL?              | no       | Banner for now-playing view                 |
| `genre`                | string?           | no       | Free-text genre from source                 |
| `normalizedGenre`      | string?           | no       | Lowercase ASCII genre tag                   |
| `tags`                 | string[]?         | no       | Extra tags (mood, era, language)            |
| `language`             | ISO 639-1?        | no       | 'fa', 'en', 'ko', 'ar', ...                |
| `releaseYear`          | number?           | no       | Numeric year                                |
| `releaseDate`          | ISO 8601?         | no       | Full date if known                          |
| `durationSec`          | number?           | no       | Duration in seconds                         |
| `trackNumber`          | number?           | no       | Track number within album                   |
| `totalTracks`          | number?           | no       | Total tracks in album                       |
| `discNumber`           | number?           | no       | Disc number                                 |
| `sources`              | AudioSource[]     | yes      | Ordered list of audio sources (see below)   |
| `sourceUrl`            | URL?              | no       | Original page URL                           |
| `source`               | ContentSource     | yes      | Where this content originated               |
| `sourceId`             | string?           | no       | Source-specific post ID (e.g. WP post ID)   |
| `sourceCoverUrl`       | URL?              | no       | Source-specific cover (provenance)          |
| `descriptionHtml`      | string?           | no       | HTML description (sanitized)                |
| `descriptionText`      | string?           | no       | Plain-text description                      |
| `author`               | string?           | no       | Author/uploader on source site              |
| `publishedAt`          | ISO 8601?         | no       | Date published on source                    |
| `likeCount`            | number            | yes (0)  | Engagement count from source                |
| `dislikeCount`         | number            | yes (0)  | Engagement count from source                |
| `commentCount`         | number            | yes (0)  | Engagement count from source                |
| `viewCount`            | number            | yes (0)  | Engagement count from source                |
| `isCurated`            | boolean           | yes      | Admin has reviewed                          |
| `isFeatured`           | boolean           | yes      | Shown on PWA home screen                    |
| `isHidden`             | boolean           | yes      | Soft-delete from PWA                        |
| `classifierConfidence` | number?           | no       | 0–1                                         |
| `classifierMethod`     | string?           | no       | heuristic / tfjs / manual / source          |
| `featureVector`        | number[]?         | no       | For similarity-based smart shuffle          |
| `createdAt`            | ISO 8601          | yes      |                                             |
| `updatedAt`            | ISO 8601          | yes      |                                             |

### AudioSource

The `sources` array is tried in order during playback. Local sources are
preferred (cached); remote sources are fallbacks.

| Field         | Type     | Required | Description                                  |
| ------------- | -------- | -------- | -------------------------------------------- |
| `type`        | 'local' \| 'remote' | yes |                                              |
| `url`         | string   | yes      | Local: relative path. Remote: absolute URL.  |
| `mimeType`    | string?  | no       | e.g. 'audio/mpeg'                            |
| `bitrateKbps` | number?  | no       |                                              |
| `sizeBytes`   | number?  | no       |                                              |
| `quality`     | number?  | no       | 128, 192, 320, 1411 (lossless)               |
| `isPreferred` | boolean? | no       | Mark the highest-quality source              |

## Artist

Deduplicated artist/performer/speaker entity. An artist can produce content of
multiple kinds (e.g. someone who both sings and gives speeches).

| Field             | Type        | Required | Description                              |
| ----------------- | ----------- | -------- | ---------------------------------------- |
| `id`              | UUID v4     | yes      |                                          |
| `name`            | string      | yes      |                                          |
| `nameRomanized`   | string?     | no       |                                          |
| `kind`            | ContentKind | yes      | Primary kind (for sorting)               |
| `imageUrl`        | URL?        | no       |                                          |
| `bio`             | string?     | no       |                                          |
| `country`         | ISO 3166-1? | no       | 'IR', 'US', 'KR', ...                   |
| `genres`          | string[]?   | no       |                                          |
| `contentCount`    | number?     | no       | Denormalized for fast list rendering     |

## Collection

Album / podcast series / Noheh album / speech series. The `kind` discriminator
determines which label to show in the UI.

| Field             | Type                                                             | Required |
| ----------------- | ---------------------------------------------------------------- | -------- |
| `id`              | UUID v4                                                          | yes      |
| `kind`            | 'album' \| 'podcast_series' \| 'noheh_album' \| 'speech_series' | yes      |
| `title`           | string                                                           | yes      |
| `titleRomanized`  | string?                                                          | no       |
| `artistId`        | UUID?                                                            | no       |
| `artistName`      | string?                                                          | no       |
| `coverImageUrl`   | URL?                                                             | no       |
| `genre`           | string?                                                          | no       |
| `normalizedGenre` | string?                                                          | no       |
| `language`        | ISO 639-1?                                                       | no       |
| `releaseYear`     | number?                                                          | no       |
| `releaseDate`     | ISO 8601?                                                        | no       |
| `totalTracks`     | number?                                                          | no       |
| `source`          | ContentSource?                                                   | no       |
| `sourceUrl`       | URL?                                                             | no       |
| `sourceId`        | string?                                                          | no       |
| `descriptionText` | string?                                                          | no       |
| `isCurated`       | boolean                                                          | yes      |
| `isFeatured`      | boolean                                                          | yes      |
| `isHidden`        | boolean                                                          | yes      |

## Playlist

A user-defined playlist in the PWA. Auto-generated playlists have `isAuto: true`
and a `generatorRule` describing how they were produced (e.g.
`'based_on:current'` for smart shuffle).

| Field             | Type     | Required | Description                              |
| ----------------- | -------- | -------- | ---------------------------------------- |
| `id`              | UUID v4  | yes      |                                          |
| `name`            | string   | yes      |                                          |
| `description`     | string?  | no       |                                          |
| `coverImageUrl`   | URL?     | no       |                                          |
| `contentIds`      | UUID[]   | yes ([]) | Ordered list of content IDs              |
| `isAuto`          | boolean? | no       |                                          |
| `generatorRule`   | string?  | no       |                                          |

## PlayEvent

A single play event. The source of truth for listening history and smart
shuffle weighting.

| Field              | Type                                                                  | Required |
| ------------------ | --------------------------------------------------------------------- | -------- |
| `id`               | UUID v4                                                               | yes      |
| `contentId`        | UUID v4                                                               | yes      |
| `playedAt`         | ISO 8601                                                              | yes      |
| `listenedSec`      | number                                                                | yes      |
| `durationSec`      | number?                                                               | no       |
| `endReason`        | 'completed' \| 'skipped' \| 'paused' \| 'error'?                     | no       |
| `skipPositionSec`  | number?                                                               | no       |
| `viaSmartShuffle`  | boolean?                                                              | no       |

## ListeningProfile

A denormalized singleton row, recomputed from `PlayEvent` rows periodically.

| Field               | Type                                                        | Required |
| ------------------- | ----------------------------------------------------------- | -------- |
| `id`                | 'singleton'                                                 | yes      |
| `topGenres`         | `{ genre, playCount, weight }[]`                            | yes ([]) |
| `topArtists`        | `{ artist, playCount, weight }[]`                           | yes ([]) |
| `topCollections`    | `{ collectionId, playCount, weight }[]`                     | yes ([]) |
| `totalPlays`        | number                                                      | yes      |
| `totalListenedSec`  | number                                                      | yes      |
| `lastUpdated`       | ISO 8601                                                    | yes      |

## Catalog file format

The admin API exports the catalog as paginated JSON. Each page is a standalone
file at `/api/v1/catalog/page-{N}.json`:

```json
{
  "version": 1,
  "generatedAt": "2025-01-01T00:00:00.000Z",
  "page": 1,
  "totalPages": 17,
  "items": [
    { "id": "...", "kind": "music", "title": "...", "artist": "...", ... },
    ...
  ]
}
```

A `manifest.json` summarizes the catalog:

```json
{
  "version": 1,
  "generatedAt": "2025-01-01T00:00:00.000Z",
  "totalPages": 17,
  "totalItems": 3314,
  "pageSize": 200
}
```

The PWA fetches `manifest.json` first, then each page in turn, upserting into
the local SQLite DB. Pages are cached by the service worker with a
stale-while-revalidate strategy.
