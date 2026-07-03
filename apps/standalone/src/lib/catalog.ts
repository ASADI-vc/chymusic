/**
 * Catalog loader — fetches JSON catalog pages and feeds them into the local SQLite DB.
 *
 * Catalog files live at `/data/catalog/page-N.json` and follow the `CatalogSchema`
 * from @chymusic/shared. The admin API generates them; the standalone PWA consumes them.
 */
import { CatalogSchema, type Content } from '@chymusic/shared';
import { run } from './db';

const CATALOG_DIR = '/data/catalog';

/** Fetch a single catalog page. Returns null if the page doesn't exist (404). */
export async function fetchCatalogPage(page: number): Promise<Content[] | null> {
  const url = `${CATALOG_DIR}/page-${page}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch catalog page ${page}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const parsed = CatalogSchema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[CHYMUSIC] Catalog page ${page} failed schema validation:`, parsed.error);
    return null;
  }
  return parsed.data.items;
}

/** Upsert a Content row into the local SQLite DB. */
export async function upsertContent(content: Content): Promise<void> {
  await run(
    `INSERT INTO content (
      id, kind, title, title_romanized, subtitle, artist, artists_json, album,
      cover_image_url, backdrop_image_url, genre, normalized_genre, tags_json,
      language, release_year, release_date, duration_sec, track_number, total_tracks, disc_number,
      sources_json, source_url, source, source_id, source_cover_url,
      description_html, description_text, author, published_at,
      like_count, dislike_count, comment_count, view_count,
      is_curated, is_featured, is_hidden,
      classifier_confidence, classifier_method, feature_vector_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      artist = excluded.artist,
      album = excluded.album,
      cover_image_url = excluded.cover_image_url,
      genre = excluded.genre,
      normalized_genre = excluded.normalized_genre,
      duration_sec = excluded.duration_sec,
      sources_json = excluded.sources_json,
      is_curated = excluded.is_curated,
      is_featured = excluded.is_featured,
      is_hidden = excluded.is_hidden,
      classifier_confidence = COALESCE(excluded.classifier_confidence, content.classifier_confidence),
      classifier_method = COALESCE(excluded.classifier_method, content.classifier_method),
      updated_at = excluded.updated_at
    `,
    [
      content.id, content.kind, content.title, content.titleRomanized ?? null, content.subtitle ?? null,
      content.artist, JSON.stringify(content.artists ?? []), content.album ?? null,
      content.coverImageUrl ?? null, content.backdropImageUrl ?? null, content.genre ?? null,
      content.normalizedGenre ?? null, JSON.stringify(content.tags ?? []),
      content.language ?? null, content.releaseYear ?? null, content.releaseDate ?? null,
      content.durationSec ?? null, content.trackNumber ?? null, content.totalTracks ?? null, content.discNumber ?? null,
      JSON.stringify(content.sources), content.sourceUrl ?? null, content.source, content.sourceId ?? null,
      content.sourceCoverUrl ?? null,
      content.descriptionHtml ?? null, content.descriptionText ?? null, content.author ?? null, content.publishedAt ?? null,
      content.likeCount ?? 0, content.dislikeCount ?? 0, content.commentCount ?? 0, content.viewCount ?? 0,
      content.isCurated ? 1 : 0, content.isFeatured ? 1 : 0, content.isHidden ? 1 : 0,
      content.classifierConfidence ?? null, content.classifierMethod ?? null,
      content.featureVector ? JSON.stringify(content.featureVector) : null,
      content.createdAt, content.updatedAt,
    ],
  );
}

/** Sync all catalog pages into the local DB. Returns the count of upserted rows. */
export async function syncCatalog(): Promise<number> {
  let count = 0;
  for (let page = 1; page < 1000; page++) {
    const items = await fetchCatalogPage(page);
    if (items === null) break;
    for (const item of items) {
      await upsertContent(item);
      count++;
    }
  }
  return count;
}
