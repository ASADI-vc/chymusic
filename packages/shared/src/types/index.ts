/**
 * CHYMUSIC shared types
 *
 * Discriminated unions for the four content kinds the platform supports:
 * music, podcast, madahi (Noheh), speech.
 *
 * All four are stored in the same `Content` table/file with a `kind` discriminator,
 * so the schema is flexible enough to add new kinds later without migrations.
 */

/** The four content kinds. Numeric values are stable for SQLite storage. */
export const ContentKind = {
  Music: 'music',
  Podcast: 'podcast',
  Madahi: 'madahi',
  Speech: 'speech',
} as const;

export type ContentKind = (typeof ContentKind)[keyof typeof ContentKind];

/** Where a piece of content originated. */
export const ContentSource = {
  /** Scraped from musicsbaran.ir (legacy dataset, mostly Persian pop/traditional). */
  Musicsbaran: 'musicsbaran',
  /** Scraped from kashoob.com (Madahi / Noheh). */
  Kashoob: 'kashoob',
  /** Scraped by the user's browser extension from any third-party site. */
  ExtensionScrape: 'extension_scrape',
  /** Manually uploaded by the user from their local filesystem. */
  UserUpload: 'user_upload',
  /** Manually imported by an admin via the admin UI. */
  AdminImport: 'admin_import',
  /** Pulled from a podcast RSS feed. */
  RssFeed: 'rss_feed',
} as const;

export type ContentSource = (typeof ContentSource)[keyof typeof ContentSource];

/** Quality tiers for cached audio files. */
export const AudioQuality = {
  Low: 128,
  Medium: 192,
  High: 320,
  Lossless: 1411,
} as const;

export type AudioQuality = (typeof AudioQuality)[keyof typeof AudioQuality];

/**
 * A unique piece of content (a song, a podcast episode, a Noheh, a speech).
 *
 * This is the central entity of the entire system. The PWA reads arrays of
 * `Content` objects from JSON catalog files; the SQLite local DB stores them
 * in a `content` table; the admin API produces them via scrapers + cleaning.
 *
 * Field naming uses camelCase for JSON/JS, snake_case for SQL columns.
 */
export interface Content {
  /** Stable UUID v4 (not sequential int — content can be merged from many sources). */
  id: string;
  kind: ContentKind;

  /** Human-readable title in the original language (Persian, English, Korean, etc.). */
  title: string;
  /** Romanized/transliterated title (optional — useful for sorting/searching). */
  titleRomanized?: string;
  /** Free-form subtitle (e.g. "feat. X" or "Episode 5"). */
  subtitle?: string;

  /** Primary artist/performer/speaker name. */
  artist: string;
  /** Additional contributors (featured artists, narrators, etc.). */
  artists?: string[];
  /** Album / collection / podcast name this content belongs to. */
  album?: string;
  /** Album art URL (relative to catalog root or absolute). */
  coverImageUrl?: string;
  /** Backdrop/banner image (optional, used in now-playing view). */
  backdropImageUrl?: string;

  /** Free-text genre for music, podcast category, etc. Source-specific. */
  genre?: string;
  /** Normalized genre tag (e.g. 'pop', 'traditional', 'noheh', 'speech'). */
  normalizedGenre?: string;
  /** Extra tags (mood, era, language). Always lowercase, ASCII-only. */
  tags?: string[];
  /** ISO 639-1 language code (e.g. 'fa', 'en', 'ko', 'ar'). */
  language?: string;
  /** Release year (numeric for sort/filter). */
  releaseYear?: number;
  /** Release date ISO 8601 if known precisely. */
  releaseDate?: string;

  /** Duration in seconds (estimated if unknown until playback). */
  durationSec?: number;
  /** Track number within album, if applicable. */
  trackNumber?: number;
  /** Total tracks in the album, if applicable. */
  totalTracks?: number;
  /** Disc number, if applicable. */
  discNumber?: number;

  /**
   * Audio sources, in priority order. The player tries each in turn:
   * 1. locally cached file (FSA path or OPFS URL)
   * 2. remote URL (streamUrl or downloadUrl)
   *
   * For scraped content, `remoteUrl` is the original page URL.
   * For cached content, `localPath` is `audio/<id>.<ext>` under the user folder.
   */
  sources: AudioSource[];

  /** Original page URL on the source site (for provenance, "View source" link). */
  sourceUrl?: string;
  /** Source website identifier. */
  source: ContentSource;
  /** Source-specific post ID (e.g. WordPress post ID on musicsbaran). */
  sourceId?: string;

  /** Cover art URL for the source site (different from coverImageUrl, kept for provenance). */
  sourceCoverUrl?: string;
  /** HTML description from the source (sanitized before display). */
  descriptionHtml?: string;
  /** Plain-text description (stripped of HTML). */
  descriptionText?: string;

  /** Author/uploader on the source site (may differ from artist). */
  author?: string;
  /** ISO 8601 date the content was published on the source site. */
  publishedAt?: string;

  /** Engagement counts from the source site (for sort/filter in admin UI). */
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  viewCount?: number;

  /** Indicates the admin has reviewed + cleaned this record. */
  isCurated: boolean;
  /** Indicates this content is featured on the home screen (set by admin). */
  isFeatured: boolean;
  /** Indicates this content is hidden from the standalone app (admin soft-delete). */
  isHidden: boolean;

  /** Genre confidence 0-1 from the classifier (heuristic or TF.js). */
  classifierConfidence?: number;
  /** Which classifier produced the `normalizedGenre`. */
  classifierMethod?: 'heuristic' | 'tfjs' | 'manual' | 'source';
  /** Classifier feature vector (for similarity-based smart shuffle). */
  featureVector?: number[];

  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** A single audio source for a `Content`. */
export interface AudioSource {
  /** Discriminator: 'local' = cached on user disk, 'remote' = fetch from URL. */
  type: 'local' | 'remote';

  /**
   * For `local`: relative path under `userSpecifiedFolder/CHYMUSIC/audio/`.
   * For `remote`: absolute URL.
   */
  url: string;

  /** Audio MIME type, e.g. 'audio/mpeg'. */
  mimeType?: string;

  /** Bitrate in kbps, if known. */
  bitrateKbps?: number;

  /** File size in bytes, if known. */
  sizeBytes?: number;

  /** Quality tier label. */
  quality?: AudioQuality;

  /** Indicates this is the highest-quality source available. */
  isPreferred?: boolean;
}

/** An artist/performer/speaker entity (deduplicated across content). */
export interface Artist {
  id: string;
  name: string;
  nameRomanized?: string;
  kind: ContentKind;
  /** Profile image URL. */
  imageUrl?: string;
  /** Bio (HTML or plain text). */
  bio?: string;
  /** Country of origin (ISO 3166-1 alpha-2). */
  country?: string;
  /** Genres associated with this artist. */
  genres?: string[];
  /** Total content count (denormalized for fast list rendering). */
  contentCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** An album / collection / podcast series. */
export interface Collection {
  id: string;
  /** Discriminator: 'album' for music, 'podcast_series' for podcasts, 'noheh_album' for madahi. */
  kind: 'album' | 'podcast_series' | 'noheh_album' | 'speech_series';
  title: string;
  titleRomanized?: string;
  artistId?: string;
  artistName?: string;
  coverImageUrl?: string;
  genre?: string;
  normalizedGenre?: string;
  language?: string;
  releaseYear?: number;
  releaseDate?: string;
  totalTracks?: number;
  source?: ContentSource;
  sourceUrl?: string;
  sourceId?: string;
  descriptionText?: string;
  isCurated: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A user-defined playlist in the standalone PWA. */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  /** Content IDs in playback order. */
  contentIds: string[];
  /** Whether the playlist is auto-generated by smart shuffle. */
  isAuto?: boolean;
  /** Generation rule for auto playlists (e.g. 'based_on:current', 'based_on:artist:X'). */
  generatorRule?: string;
  createdAt: string;
  updatedAt: string;
}

/** A play event — the source of truth for smart shuffle + listening history. */
export interface PlayEvent {
  /** UUID v4. */
  id: string;
  contentId: string;
  /** ISO 8601 timestamp when playback started. */
  playedAt: string;
  /** How many seconds were actually listened (excluding pauses/skips). */
  listenedSec: number;
  /** Total duration of the content (denormalized for fast ratio computation). */
  durationSec?: number;
  /** How playback ended: 'completed', 'skipped', 'paused', 'error'. */
  endReason?: 'completed' | 'skipped' | 'paused' | 'error';
  /** At what second the user skipped (if skipped). */
  skipPositionSec?: number;
  /** Whether this play was triggered by smart shuffle. */
  viaSmartShuffle?: boolean;
}

/** User listening preferences (denormalized from PlayEvents for fast access). */
export interface ListeningProfile {
  /** Always 'singleton' — there's one profile per device/user. */
  id: 'singleton';
  /** Top genres by play count, normalized to lowercase ASCII. */
  topGenres: { genre: string; playCount: number; weight: number }[];
  /** Top artists by play count. */
  topArtists: { artist: string; playCount: number; weight: number }[];
  /** Top collections by play count. */
  topCollections: { collectionId: string; playCount: number; weight: number }[];
  /** Total play count. */
  totalPlays: number;
  /** Total seconds listened. */
  totalListenedSec: number;
  /** Last time the profile was recomputed. */
  lastUpdated: string;
}
