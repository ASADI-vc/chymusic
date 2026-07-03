/**
 * CHYMUSIC shared constants
 */

/** Folder name under the user-specified root where everything is stored. */
export const CHYMUSIC_FOLDER_NAME = 'CHYMUSIC';

/** Subfolders under the root CHYMUSIC folder. */
export const SUBFOLDERS = {
  AUDIO: 'audio',
  COVERS: 'covers',
  METADATA: 'metadata',
  PLAYLISTS: 'playlists',
  LOGS: 'logs',
  CACHE: 'cache',
} as const;

/** SQLite database file name inside the metadata folder. */
export const SQLITE_DB_FILENAME = 'chymusic.sqlite';

/** Default page size for catalog JSON files (one JSON file per page). */
export const CATALOG_PAGE_SIZE = 200;

/** Maximum age in ms before a classifier result is considered stale. */
export const CLASSIFIER_STALE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Confidence threshold below which we fall back from heuristic to TF.js. */
export const HEURISTIC_CONFIDENCE_THRESHOLD = 0.6;

/** Confidence threshold below which we mark the content as 'unclassified'. */
export const MIN_CONFIDENCE = 0.4;

/** Number of recommendations smart shuffle produces per round. */
export const SMART_SHUFFLE_BATCH_SIZE = 20;

/** Maximum history items considered for smart shuffle weighting. */
export const SMART_SHUFFLE_HISTORY_WINDOW = 50;

/** Known source websites and their classifiers (used by the extension). */
export const KNOWN_SOURCES = {
  'musicsbaran.ir': {
    name: 'Musicsbaran',
    kind: 'music' as const,
    /** CSS selectors for scraping album/track pages. */
    selectors: {
      albumTitle: 'h1.entry-title, .album-title',
      albumArtist: '.album-artist, .artist-name',
      trackList: '.track-list li, .songs-list li',
      trackTitle: '.track-title, .song-title',
      trackDownloadUrl: 'a[href*="dl."], a.download-link',
      coverImage: '.album-cover img, .cover-image img',
    },
  },
  'kashoob.com': {
    name: 'Kashoob',
    kind: 'madahi' as const,
    selectors: {
      albumTitle: 'h1.entry-title',
      trackList: '.nohe-list li, .track-list li',
      trackTitle: '.nohe-title, .track-title',
      trackDownloadUrl: 'a[href$=".mp3"], a.download',
      coverImage: '.nohe-cover img, .album-cover img',
    },
  },
} as const;

/** File extensions considered audio for scraping detection. */
export const AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wav',
  'flac',
  'webm',
] as const;

/** MIME types considered audio for scraping detection. */
export const AUDIO_MIME_PREFIXES = ['audio/'];

/** Pattern for the "user can scrape" permission prompt — show once per host. */
export const SCRAPE_PERMISSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Default cover image used when none is available. */
export const DEFAULT_COVER_URL = '/img/default-cover.svg';
