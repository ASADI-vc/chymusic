/**
 * Local SQLite database (sql.js) singleton for the standalone PWA.
 *
 * Loads sql.js from the bundled wasm, opens (or creates) the CHYMUSIC database,
 * and exposes a typed query helper. The DB file is persisted to OPFS so it
 * survives across sessions.
 *
 * Schema mirrors the `Content` / `Artist` / `Collection` / `Playlist` /
 * `PlayEvent` types from @chymusic/shared.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { get, set } from 'idb-keyval';
import { CHYMUSIC_FOLDER_NAME, SQLITE_DB_FILENAME, SUBFOLDERS } from '@chymusic/shared';

const DB_STORAGE_KEY = 'chymusic:sqlite-db';
const SQL_WASM_PATH = '/sql-wasm.wasm';

let sqlPromise: Promise<SqlJsStatic> | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => SQL_WASM_PATH });
  }
  return sqlPromise;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  title_romanized TEXT,
  subtitle TEXT,
  artist TEXT NOT NULL,
  artists_json TEXT,
  album TEXT,
  cover_image_url TEXT,
  backdrop_image_url TEXT,
  genre TEXT,
  normalized_genre TEXT,
  tags_json TEXT,
  language TEXT,
  release_year INTEGER,
  release_date TEXT,
  duration_sec REAL,
  track_number INTEGER,
  total_tracks INTEGER,
  disc_number INTEGER,
  sources_json TEXT NOT NULL,
  source_url TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  source_cover_url TEXT,
  description_html TEXT,
  description_text TEXT,
  author TEXT,
  published_at TEXT,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_curated INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  classifier_confidence REAL,
  classifier_method TEXT,
  feature_vector_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_kind ON content(kind);
CREATE INDEX IF NOT EXISTS idx_content_artist ON content(artist);
CREATE INDEX IF NOT EXISTS idx_content_album ON content(album);
CREATE INDEX IF NOT EXISTS idx_content_normalized_genre ON content(normalized_genre);
CREATE INDEX IF NOT EXISTS idx_content_is_featured ON content(is_featured) WHERE is_featured = 1;
CREATE INDEX IF NOT EXISTS idx_content_is_hidden ON content(is_hidden) WHERE is_hidden = 0;

CREATE TABLE IF NOT EXISTS artist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_romanized TEXT,
  kind TEXT NOT NULL,
  image_url TEXT,
  bio TEXT,
  country TEXT,
  genres_json TEXT,
  content_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  title_romanized TEXT,
  artist_id TEXT,
  artist_name TEXT,
  cover_image_url TEXT,
  genre TEXT,
  normalized_genre TEXT,
  language TEXT,
  release_year INTEGER,
  release_date TEXT,
  total_tracks INTEGER,
  source TEXT,
  source_url TEXT,
  source_id TEXT,
  description_text TEXT,
  is_curated INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (artist_id) REFERENCES artist(id)
);

CREATE INDEX IF NOT EXISTS idx_collection_kind ON collection(kind);
CREATE INDEX IF NOT EXISTS idx_collection_artist ON collection(artist_id);

CREATE TABLE IF NOT EXISTS playlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  content_ids_json TEXT NOT NULL DEFAULT '[]',
  is_auto INTEGER NOT NULL DEFAULT 0,
  generator_rule TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS play_event (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  played_at TEXT NOT NULL,
  listened_sec REAL NOT NULL DEFAULT 0,
  duration_sec REAL,
  end_reason TEXT,
  skip_position_sec REAL,
  via_smart_shuffle INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_play_event_content ON play_event(content_id);
CREATE INDEX IF NOT EXISTS idx_play_event_played_at ON play_event(played_at);

CREATE TABLE IF NOT EXISTS listening_profile (
  id TEXT PRIMARY KEY,
  top_genres_json TEXT NOT NULL DEFAULT '[]',
  top_artists_json TEXT NOT NULL DEFAULT '[]',
  top_collections_json TEXT NOT NULL DEFAULT '[]',
  total_plays INTEGER NOT NULL DEFAULT 0,
  total_listened_sec REAL NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scrape_permission (
  host TEXT PRIMARY KEY,
  granted_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`;

let dbInstance: Database | null = null;

async function persistDb(db: Database): Promise<void> {
  const data = db.export();
  await set(DB_STORAGE_KEY, data);
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await loadSqlJs();
  const saved = await get<ArrayBuffer>(DB_STORAGE_KEY);
  const db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();

  db.run(SCHEMA_SQL);

  dbInstance = db;
  return db;
}

export async function saveDb(): Promise<void> {
  if (!dbInstance) return;
  await persistDb(dbInstance);
}

/**
 * Run a SQL query and return typed rows.
 *
 * Usage:
 *   const rows = await query<{ id: string; title: string }>(
 *     'SELECT id, title FROM content WHERE kind = ? LIMIT 10',
 *     ['music'],
 *   );
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/**
 * Run a SQL statement that does not return rows (INSERT/UPDATE/DELETE).
 * Auto-persists the DB to OPFS after a successful write.
 */
export async function run(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  db.run(sql, params as never);
  await saveDb();
}

/**
 * Export the entire DB as a binary blob. Used by the "export library" feature
 * and for syncing to the admin API (if the user opts in).
 */
export async function exportDb(): Promise<Uint8Array> {
  const db = await getDb();
  return db.export();
}
