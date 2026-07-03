/**
 * CHYMUSIC Zod schemas — runtime validation for content, artists, playlists, etc.
 *
 * These mirror the TypeScript types in `../types` and are the single source of
 * truth for validating data that crosses component boundaries:
 *   - JSON catalog files loaded by the standalone PWA
 *   - Records exchanged between the extension and the PWA via postMessage
 *   - Records exported by the admin API
 */
import { z } from 'zod';

export const ContentKindSchema = z.enum(['music', 'podcast', 'madahi', 'speech']);

export const ContentSourceSchema = z.enum([
  'musicsbaran',
  'kashoob',
  'extension_scrape',
  'user_upload',
  'admin_import',
  'rss_feed',
]);

export const AudioQualitySchema = z.union([z.literal(128), z.literal(192), z.literal(320), z.literal(1411)]);

export const AudioSourceSchema = z.object({
  type: z.enum(['local', 'remote']),
  url: z.string().min(1),
  mimeType: z.string().optional(),
  bitrateKbps: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  quality: AudioQualitySchema.optional(),
  isPreferred: z.boolean().optional(),
});

export const ContentSchema = z.object({
  id: z.string().uuid(),
  kind: ContentKindSchema,
  title: z.string().min(1),
  titleRomanized: z.string().optional(),
  subtitle: z.string().optional(),
  artist: z.string().min(1),
  artists: z.array(z.string()).optional(),
  album: z.string().optional(),
  coverImageUrl: z.string().url().or(z.string().startsWith('/')).optional(),
  backdropImageUrl: z.string().url().optional(),
  genre: z.string().optional(),
  normalizedGenre: z.string().optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  releaseDate: z.string().datetime().optional(),
  durationSec: z.number().positive().optional(),
  trackNumber: z.number().int().positive().optional(),
  totalTracks: z.number().int().positive().optional(),
  discNumber: z.number().int().positive().optional(),
  sources: z.array(AudioSourceSchema).min(1),
  sourceUrl: z.string().url().optional(),
  source: ContentSourceSchema,
  sourceId: z.string().optional(),
  sourceCoverUrl: z.string().url().optional(),
  descriptionHtml: z.string().optional(),
  descriptionText: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  likeCount: z.number().int().nonnegative().optional(),
  dislikeCount: z.number().int().nonnegative().optional(),
  commentCount: z.number().int().nonnegative().optional(),
  viewCount: z.number().int().nonnegative().optional(),
  isCurated: z.boolean(),
  isFeatured: z.boolean(),
  isHidden: z.boolean(),
  classifierConfidence: z.number().min(0).max(1).optional(),
  classifierMethod: z.enum(['heuristic', 'tfjs', 'manual', 'source']).optional(),
  featureVector: z.array(z.number()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ArtistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  nameRomanized: z.string().optional(),
  kind: ContentKindSchema,
  imageUrl: z.string().url().optional(),
  bio: z.string().optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  genres: z.array(z.string()).optional(),
  contentCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CollectionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['album', 'podcast_series', 'noheh_album', 'speech_series']),
  title: z.string().min(1),
  titleRomanized: z.string().optional(),
  artistId: z.string().uuid().optional(),
  artistName: z.string().optional(),
  coverImageUrl: z.string().url().or(z.string().startsWith('/')).optional(),
  genre: z.string().optional(),
  normalizedGenre: z.string().optional(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  releaseDate: z.string().datetime().optional(),
  totalTracks: z.number().int().positive().optional(),
  source: ContentSourceSchema.optional(),
  sourceUrl: z.string().url().optional(),
  sourceId: z.string().optional(),
  descriptionText: z.string().optional(),
  isCurated: z.boolean(),
  isFeatured: z.boolean(),
  isHidden: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlaylistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().or(z.string().startsWith('/')).optional(),
  contentIds: z.array(z.string().uuid()),
  isAuto: z.boolean().optional(),
  generatorRule: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlayEventSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  playedAt: z.string().datetime(),
  listenedSec: z.number().nonnegative(),
  durationSec: z.number().positive().optional(),
  endReason: z.enum(['completed', 'skipped', 'paused', 'error']).optional(),
  skipPositionSec: z.number().nonnegative().optional(),
  viaSmartShuffle: z.boolean().optional(),
});

export const CatalogSchema = z.object({
  /** Schema version, bumped on breaking changes. */
  version: z.literal(1),
  /** ISO 8601 timestamp when this catalog page was generated. */
  generatedAt: z.string().datetime(),
  /** Page number (1-indexed). */
  page: z.number().int().positive(),
  /** Total pages in the catalog. */
  totalPages: z.number().int().positive(),
  /** Content records on this page. */
  items: z.array(ContentSchema),
});
