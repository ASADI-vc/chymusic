import { useEffect, useState } from 'react';
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

function rowToContent(row: ContentRow): Content {
  return {
    id: row.id,
    kind: row.kind as Content['kind'],
    title: row.title,
    titleRomanized: row.title_romanized ?? undefined,
    subtitle: row.subtitle ?? undefined,
    artist: row.artist,
    artists: row.artists_json ? JSON.parse(row.artists_json) : undefined,
    album: row.album ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    backdropImageUrl: row.backdrop_image_url ?? undefined,
    genre: row.genre ?? undefined,
    normalizedGenre: row.normalized_genre ?? undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
    language: row.language ?? undefined,
    releaseYear: row.release_year ?? undefined,
    releaseDate: row.release_date ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    trackNumber: row.track_number ?? undefined,
    totalTracks: row.total_tracks ?? undefined,
    discNumber: row.disc_number ?? undefined,
    sources: JSON.parse(row.sources_json),
    source: row.source as Content['source'],
    sourceUrl: row.source_url ?? undefined,
    sourceId: row.source_id ?? undefined,
    sourceCoverUrl: row.source_cover_url ?? undefined,
    descriptionHtml: row.description_html ?? undefined,
    descriptionText: row.description_text ?? undefined,
    author: row.author ?? undefined,
    publishedAt: row.published_at ?? undefined,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    isCurated: row.is_curated === 1,
    isFeatured: row.is_featured === 1,
    isHidden: row.is_hidden === 1,
    classifierConfidence: row.classifier_confidence ?? undefined,
    classifierMethod: row.classifier_method as Content['classifierMethod'] ?? undefined,
    featureVector: row.feature_vector_json ? JSON.parse(row.feature_vector_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function HomePage() {
  const [featured, setFeatured] = useState<Content[]>([]);
  const [recent, setRecent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNow } = usePlayerStore();

  useEffect(() => {
    (async () => {
      try {
        const featuredRows = await query<ContentRow>(
          `SELECT * FROM content WHERE is_featured = 1 AND is_hidden = 0 LIMIT 12`,
        );
        setFeatured(featuredRows.map(rowToContent));

        const recentRows = await query<ContentRow>(
          `SELECT * FROM content WHERE is_hidden = 0 ORDER BY created_at DESC LIMIT 12`,
        );
        setRecent(recentRows.map(rowToContent));
      } catch (err) {
        console.warn('[CHYMUSIC] Home load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page__title">Good evening</h1>
        <p className="page__subtitle">Loading your catalog…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Good evening</h1>
      <p className="page__subtitle">
        {featured.length > 0
          ? `${featured.length} curated picks for you.`
          : 'No catalog loaded yet — open Settings to sync the catalog.'}
      </p>

      {featured.length > 0 && (
        <section>
          <h2 className="page__title" style={{ fontSize: 20 }}>Featured</h2>
          <div className="card-grid">
            {featured.map((c) => (
              <div key={c.id} className="card" onClick={() => playNow(c, featured)}>
                <img className="card__cover" src={c.coverImageUrl ?? '/img/default-cover.svg'} alt="" />
                <div className="card__title">{c.title}</div>
                <div className="card__subtitle">{c.artist}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="page__title" style={{ fontSize: 20 }}>Recently added</h2>
          <div className="card-grid">
            {recent.map((c) => (
              <div key={c.id} className="card" onClick={() => playNow(c, recent)}>
                <img className="card__cover" src={c.coverImageUrl ?? '/img/default-cover.svg'} alt="" />
                <div className="card__title">{c.title}</div>
                <div className="card__subtitle">{c.artist}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
