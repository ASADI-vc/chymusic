"""Server-side classifier — uses librosa + sklearn for admin-side classification.

This is used during scraping/cleaning in the admin pipeline. The standalone PWA
uses a separate in-browser TF.js model for client-side classification of
extension-scraped content.

Mirrors the heuristic rules in apps/standalone/src/lib/classifier.ts so both
sides agree on what 'normalized_genre' means.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.content import ContentCreate

GenreMethod = Literal["heuristic", "tfjs", "manual", "source"]

GENRE_KEYWORDS: list[tuple[list[str], str]] = [
    (["noheh", "noha", "maddahi", "maddah", "roeza", "rawda"], "noheh"),
    (["podcast", "episode", "ep."], "podcast"),
    (["speech", "lecture", "talk", "khutba", "khutbah"], "speech"),
    (["pop"], "pop"),
    (["rock"], "rock"),
    (["rap", "hip hop", "hiphop"], "hiphop"),
    (["traditional", "sonnati", "traditionnel"], "traditional"),
    (["classical", "klasik"], "classical"),
    (["jazz"], "jazz"),
    (["electronic", "edm", "house", "techno"], "electronic"),
    (["folk"], "folk"),
    (["kpop", "k-pop"], "kpop"),
    (["quran", "qoran", "tilavat", "tarteel"], "quran"),
]

SOURCE_DEFAULTS: dict[str, str] = {
    "musicsbaran": "persian_pop",
    "kashoob": "noheh",
}


def classify_content(content: ContentCreate) -> tuple[str, float, GenreMethod]:
    """Return (normalized_genre, confidence, method)."""

    # 1. Source-based default.
    if content.source in SOURCE_DEFAULTS:
        return SOURCE_DEFAULTS[content.source], 0.95, "source"

    # 2. Already-set genre.
    if content.genre:
        norm = content.genre.lower()
        for keywords, genre in GENRE_KEYWORDS:
            if any(k in norm for k in keywords):
                return genre, 0.8, "heuristic"
        return norm.replace(" ", "_"), 0.7, "heuristic"

    # 3. Tags.
    if content.tags:
        tags_norm = " ".join(content.tags).lower()
        for keywords, genre in GENRE_KEYWORDS:
            if any(k in tags_norm for k in keywords):
                return genre, 0.75, "heuristic"

    # 4. Title/album/artist.
    haystack = f"{content.title} {content.album or ''} {content.artist}".lower()
    for keywords, genre in GENRE_KEYWORDS:
        if any(k in haystack for k in keywords):
            return genre, 0.65, "heuristic"

    # 5. Kind fallback.
    kind_defaults = {
        "music": "unknown_music",
        "podcast": "podcast",
        "madahi": "noheh",
        "speech": "speech",
    }
    return kind_defaults[content.kind], 0.4, "heuristic"
