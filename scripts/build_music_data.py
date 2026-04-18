from __future__ import annotations

import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "app.db"
DATA_DIR = ROOT / "wwwroot" / "data"
ALBUM_DIR = DATA_DIR / "albums"


def normalize(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip().lower()
    value = re.sub(r"[\-–/,;()]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def split_multi(value: str | None) -> list[str]:
    """Split comma-separated string into trimmed, non-empty parts."""
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))


conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

categories = defaultdict(list)
for row in conn.execute(
    """
    select l.album_id, c.name
    from album_category_link l
    join album_categories c on c.id = l.category_id
    order by l.album_id, c.name
    """
):
    categories[row["album_id"]].append(row["name"])

tags = defaultdict(list)
for row in conn.execute(
    """
    select l.album_id, t.name
    from album_tag_link l
    join album_tags t on t.id = l.tag_id
    order by l.album_id, t.name
    """
):
    tags[row["album_id"]].append(row["name"])

tracks_by_album = defaultdict(list)
for row in conn.execute(
    """
    select id, album_id, "index", title, download_url_320, download_url_128, stream_url
    from tracks
    order by album_id, "index", id
    """
):
    tracks_by_album[row["album_id"]].append(
        {
            "id": row["id"],
            "index": row["index"],
            "title": row["title"],
            "downloadUrl320": row["download_url_320"],
            "downloadUrl128": row["download_url_128"],
            "streamUrl": row["stream_url"],
        }
    )

album_rows = list(
    conn.execute(
        """
        select id, title_fa, album_name, artist_name, slug_url, cover_image_url, description_text,
               published_at, released, tracks_count, format, genre, like_count, dislike_count,
               comment_count, zip_download_url, zip_size_mb
        from albums
        order by id
        """
    )
)

summary_albums = []
featured_rows = []
fresh_tracks = []
search_albums = []
search_tracks = []
unique_genres = set()
track_count = 0

for row in album_rows:
    album_id = row["id"]
    album_name = row["album_name"] or row["title_fa"]
    artist_name = row["artist_name"] or "Unknown artist"
    album_tracks = tracks_by_album.get(album_id, [])
    album_categories = categories.get(album_id, [])
    album_tags = tags.get(album_id, [])
    genre_array = split_multi(row["genre"])
    artist_array = split_multi(row["artist_name"])

    for g in genre_array:
        unique_genres.add(g.casefold())

    detail_payload = {
        "id": album_id,
        "titleFa": row["title_fa"],
        "albumName": row["album_name"],
        "artistName": artist_array,                     # array now
        "slugUrl": row["slug_url"],
        "coverImageUrl": row["cover_image_url"],
        "descriptionText": row["description_text"],
        "publishedAt": row["published_at"],
        "released": row["released"],
        "tracksCount": row["tracks_count"] or 0,
        "format": row["format"],
        "genre": genre_array,                           # array now
        "likeCount": row["like_count"],
        "dislikeCount": row["dislike_count"],
        "commentCount": row["comment_count"],
        "zipDownloadUrl": row["zip_download_url"],
        "zipSizeMb": row["zip_size_mb"],
        "categories": album_categories,
        "tags": album_tags,
        "tracks": album_tracks,
    }
    write_json(ALBUM_DIR / f"{album_id}.json", detail_payload)

    summary = {
        "id": album_id,
        "titleFa": row["title_fa"],
        "albumName": row["album_name"],
        "artistName": artist_array,                     # array now
        "coverImageUrl": row["cover_image_url"],
        "publishedAt": row["published_at"],
        "tracksCount": row["tracks_count"] or 0,
        "genre": genre_array,                           # array now
        "likeCount": row["like_count"],
        "commentCount": row["comment_count"],
    }
    summary_albums.append(summary)

    featured_score = row["like_count"] + row["comment_count"] * 3 + (row["tracks_count"] or 0) * 5
    featured_rows.append((featured_score, album_id, summary))

    # For search we still need a single string for full‑text matching.
    search_albums.append(
        {
            "albumId": album_id,
            "title": album_name,
            "artist": artist_name,                      # original string for search display
            "coverImageUrl": row["cover_image_url"],
            "genre": row["genre"],                      # original string for search display
            "scoreHint": featured_score,
            "searchText": normalize(
                " ".join(
                    [
                        row["title_fa"] or "",
                        row["album_name"] or "",
                        row["artist_name"] or "",
                        row["genre"] or "",
                        " ".join(album_categories),
                        " ".join(album_tags[:24]),
                    ]
                )
            ),
        }
    )

    for track in album_tracks:
        track_count += 1
        if not (track["downloadUrl320"] or track["downloadUrl128"] or track["streamUrl"]):
            continue
        search_tracks.append(
            {
                "albumId": album_id,
                "trackId": track["id"],
                "index": track["index"],
                "title": track["title"],
                "albumTitle": album_name,
                "artist": artist_name,
                "coverImageUrl": row["cover_image_url"],
                "genre": row["genre"],
                "scoreHint": featured_score,
                "searchText": normalize(
                    " ".join(
                        [
                            track["title"] or "",
                            album_name,
                            row["title_fa"] or "",
                            artist_name,
                            row["genre"] or "",
                        ]
                    )
                ),
            }
        )

# Fresh tracks (unchanged)
for album in sorted(summary_albums, key=lambda item: item["id"], reverse=True):
    album_id = album["id"]
    for track in tracks_by_album.get(album_id, [])[: min(3, len(tracks_by_album.get(album_id, [])))]:
        if not (track["downloadUrl320"] or track["downloadUrl128"] or track["streamUrl"]):
            continue
        fresh_tracks.append(
            {
                "albumId": album_id,
                "trackId": track["id"],
                "index": track["index"],
                "title": track["title"],
                "albumTitle": album["albumName"] or album["titleFa"],
                "artist": album["artistName"][0] if album["artistName"] else "Unknown artist",
                "genre": ", ".join(album["genre"]) if album["genre"] else "",
                "coverImageUrl": album["coverImageUrl"],
            }
        )
        if len(fresh_tracks) >= 24:
            break
    if len(fresh_tracks) >= 24:
        break

featured = [item[2] for item in sorted(featured_rows, key=lambda row: (row[0], row[1]), reverse=True)[:12]]

write_json(
    DATA_DIR / "catalog-summary.json",
    {
        "albumCount": len(summary_albums),
        "trackCount": track_count,
        "genreCount": len(unique_genres),
        "albums": summary_albums,
    },
)
write_json(DATA_DIR / "featured.json", {"albums": featured})
write_json(DATA_DIR / "fresh-tracks.json", {"tracks": fresh_tracks})
write_json(DATA_DIR / "search-index.json", {"albums": search_albums, "tracks": search_tracks})

print(f"albums={len(summary_albums)} tracks={track_count} genres={len(unique_genres)}")
print(f"featured={len(featured)} fresh={len(fresh_tracks)}")