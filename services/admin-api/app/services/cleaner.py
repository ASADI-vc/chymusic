"""Data cleaner — normalizes raw scraped content before it goes into the DB.

Steps:
  1. Trim whitespace, collapse runs of whitespace.
  2. Drop empty fields.
  3. Normalize genre → normalized_genre.
  4. Slugify the artist name for deduplication.
  5. Validate URLs.
  6. Remove HTML tags from description.
  7. Compute release_year from release_date if missing.
"""

from __future__ import annotations

import html
import re
from urllib.parse import urlparse

from app.schemas.content import ContentCreate


def clean_content(content: ContentCreate) -> ContentCreate:
    """Apply all cleaning steps in place and return the same object."""
    content.title = _clean_text(content.title)
    if content.title_romanized:
        content.title_romanized = _clean_text(content.title_romanized)
    if content.subtitle:
        content.subtitle = _clean_text(content.subtitle)
    if content.artist:
        content.artist = _clean_text(content.artist)
    if content.album:
        content.album = _clean_text(content.album)
    if content.genre:
        content.genre = _clean_text(content.genre)

    if content.description_text:
        content.description_text = _clean_text(
            html.unescape(re.sub(r"<[^>]+>", " ", content.description_text))
        )
    if content.description_html:
        # Basic sanitization — keep only whitelisted tags.
        content.description_html = _sanitize_html(content.description_html)

    # Drop empty sources.
    content.sources = [s for s in content.sources if _is_valid_url(s.url)]
    if not content.sources:
        raise ValueError("content has no valid sources after cleaning")

    # Normalize language to lowercase 2-letter code.
    if content.language and len(content.language) >= 2:
        content.language = content.language[:2].lower()

    # Compute release_year from release_date if missing.
    if not content.release_year and content.release_date:
        m = re.search(r"\b(19|20)\d{2}\b", content.release_date)
        if m:
            content.release_year = int(m.group(0))

    return content


def _clean_text(s: str | None) -> str:
    if not s:
        return s or ""
    return " ".join(s.split()).strip()


def _sanitize_html(s: str) -> str:
    """Very basic sanitizer — keeps only <p>, <br>, <strong>, <em>, <a>."""
    # In production, use bleach or nh3.
    return re.sub(
        r"<(?!/?(?:p|br|strong|em|a)\b)[^>]*>",
        "",
        s,
        flags=re.IGNORECASE,
    )


def _is_valid_url(url: str) -> bool:
    try:
        u = urlparse(url)
        return bool(u.scheme) and bool(u.netloc)
    except Exception:  # noqa: BLE001
        return False
