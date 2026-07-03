import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { query } from '@/lib/db';
import type { Content } from '@chymusic/shared';
import { usePlayerStore } from '@/store/playerStore';

interface ContentRow {
  id: string;
  kind: string;
  title: string;
  artist: string;
  album: string | null;
  cover_image_url: string | null;
  duration_sec: number | null;
  sources_json: string;
  is_featured: number;
  is_curated: number;
  is_hidden: number;
  genre: string | null;
  normalized_genre: string | null;
  language: string | null;
  release_year: number | null;
  tags_json: string;
  title_romanized: string | null;
  subtitle: string | null;
  artists_json: string;
  backdrop_image_url: string | null;
  source: string;
  source_url: string | null;
  source_id: string | null;
  source_cover_url: string | null;
  description_html: string | null;
  description_text: string | null;
  author: string | null;
  published_at: string | null;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  view_count: number;
  classifier_confidence: number | null;
  classifier_method: string | null;
  feature_vector_json: string | null;
  track_number: number | null;
  total_tracks: number | null;
  disc_number: number | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

const ALL_FIELDS = `id, kind, title, title_romanized, subtitle, artist, artists_json, album,
  cover_image_url, backdrop_image_url, genre, normalized_genre, tags_json, language,
  release_year, release_date, duration_sec, track_number, total_tracks, disc_number,
  sources_json, source_url, source, source_id, source_cover_url,
  description_html, description_text, author, published_at,
  like_count, dislike_count, comment_count, view_count,
  is_curated, is_featured, is_hidden,
  classifier_confidence, classifier_method, feature_vector_json,
  created_at, updated_at`;

export function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const { playNow } = usePlayerStore();

  const doSearch = async (query: string) => {
    setQ(query);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const like = `%${query.trim()}%`;
      const rows = await query<ContentRow>(
        `SELECT ${ALL_FIELDS} FROM content
         WHERE is_hidden = 0 AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)
         ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, title
         LIMIT 50`,
        [like, like, like, `${query.trim()}%`],
      );
      setResults(
        rows.map((row) => ({
          id: row.id,
          kind: row.kind as Content['kind'],
          title: row.title,
          artist: row.artist,
          album: row.album ?? undefined,
          coverImageUrl: row.cover_image_url ?? undefined,
          durationSec: row.duration_sec ?? undefined,
          sources: JSON.parse(row.sources_json),
          source: row.source as Content['source'],
          isCurated: row.is_curated === 1,
          isFeatured: row.is_featured === 1,
          isHidden: row.is_hidden === 1,
          genre: row.genre ?? undefined,
          normalizedGenre: row.normalized_genre ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      );
    } catch (err) {
      console.warn('[CHYMUSIC] Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="search-bar">
        <SearchIcon size={20} />
        <input
          type="text"
          value={q}
          onChange={(e) => doSearch(e.target.value)}
          placeholder="Songs, artists, albums"
          className="search-bar__input"
          autoFocus
        />
      </div>

      {loading && <p className="page__subtitle">Searching…</p>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((c) => (
            <div key={c.id} className="search-result" onClick={() => playNow(c, results)}>
              <img className="search-result__cover" src={c.coverImageUrl ?? '/img/default-cover.svg'} alt="" />
              <div className="search-result__meta">
                <div className="search-result__title">{c.title}</div>
                <div className="search-result__artist">{c.artist}{c.album ? ` · ${c.album}` : ''}</div>
              </div>
              <span className="search-result__kind">{c.kind}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="page__subtitle">No results for "{q}"</p>
      )}

      <style>{`
        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--chy-hover);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--chy-border);
        }
        .search-bar__input {
          background: transparent;
          border: none;
          color: var(--chy-fg);
          font-size: 15px;
          flex: 1;
          outline: none;
        }
        .search-results {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .search-result {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
        }
        .search-result:hover {
          background: var(--chy-hover);
        }
        .search-result__cover {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
        }
        .search-result__title {
          font-size: 14px;
          font-weight: 500;
        }
        .search-result__artist {
          font-size: 12px;
          color: var(--chy-fg-muted);
        }
        .search-result__kind {
          font-size: 10px;
          color: var(--chy-fg-muted);
          text-transform: uppercase;
          padding: 2px 8px;
          background: var(--chy-hover);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
