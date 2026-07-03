"""Catalog exporter — writes paginated JSON files the standalone PWA consumes.

Output structure (under data/exports/catalog/):
  page-1.json
  page-2.json
  ...
  manifest.json   # contains { version, generatedAt, totalPages, totalItems }

Each page-N.json follows the CatalogSchema from @chymusic/shared.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content import Content


def _row_to_dict(c: Content) -> dict:
    import json as _json

    return {
        "id": c.id,
        "kind": c.kind,
        "title": c.title,
        "titleRomanized": c.title_romanized,
        "subtitle": c.subtitle,
        "artist": c.artist,
        "artists": _json.loads(c.artists_json) if c.artists_json else None,
        "album": c.album,
        "coverImageUrl": c.cover_image_url,
        "backdropImageUrl": c.backdrop_image_url,
        "genre": c.genre,
        "normalizedGenre": c.normalized_genre,
        "tags": _json.loads(c.tags_json) if c.tags_json else None,
        "language": c.language,
        "releaseYear": c.release_year,
        "releaseDate": c.release_date,
        "durationSec": c.duration_sec,
        "trackNumber": c.track_number,
        "totalTracks": c.total_tracks,
        "discNumber": c.disc_number,
        "sources": _json.loads(c.sources_json),
        "sourceUrl": c.source_url,
        "source": c.source,
        "sourceId": c.source_id,
        "sourceCoverUrl": c.source_cover_url,
        "descriptionHtml": c.description_html,
        "descriptionText": c.description_text,
        "author": c.author,
        "publishedAt": c.published_at,
        "likeCount": c.like_count,
        "dislikeCount": c.dislike_count,
        "commentCount": c.comment_count,
        "viewCount": c.view_count,
        "isCurated": c.is_curated,
        "isFeatured": c.is_featured,
        "isHidden": c.is_hidden,
        "classifierConfidence": c.classifier_confidence,
        "classifierMethod": c.classifier_method,
        "featureVector": _json.loads(c.feature_vector_json) if c.feature_vector_json else None,
        "createdAt": c.created_at.isoformat(),
        "updatedAt": c.updated_at.isoformat(),
    }


def export_catalog(db: Session, page_size: int | None = None) -> Path:
    """Export all non-hidden content to paginated JSON. Returns the export dir."""
    page_size = page_size or settings.catalog_page_size
    out_dir = settings.exports_dir / "catalog"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Clear previous export.
    for f in out_dir.glob("page-*.json"):
        f.unlink()
    (out_dir / "manifest.json").unlink(missing_ok=True)

    # Query all visible content.
    stmt = (
        select(Content)
        .where(Content.is_hidden == False)  # noqa: E712
        .order_by(Content.is_featured.desc(), Content.updated_at.desc())
    )
    all_items = db.execute(stmt).scalars().all()

    total_pages = max(1, (len(all_items) + page_size - 1) // page_size)
    generated_at = datetime.now(UTC).isoformat()

    for page_idx in range(total_pages):
        start = page_idx * page_size
        end = start + page_size
        page_items = all_items[start:end]
        payload = {
            "version": 1,
            "generatedAt": generated_at,
            "page": page_idx + 1,
            "totalPages": total_pages,
            "items": [_row_to_dict(c) for c in page_items],
        }
        out_file = out_dir / f"page-{page_idx + 1}.json"
        out_file.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    manifest = {
        "version": 1,
        "generatedAt": generated_at,
        "totalPages": total_pages,
        "totalItems": len(all_items),
        "pageSize": page_size,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return out_dir
