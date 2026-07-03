"""Content schemas — mirror @chymusic/shared but with Python-friendly snake_case."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


ContentKind = Literal["music", "podcast", "madahi", "speech"]
ContentSource = Literal[
    "musicsbaran", "kashoob", "extension_scrape", "user_upload", "admin_import", "rss_feed"
]


class AudioSourceSchema(BaseModel):
    type: Literal["local", "remote"]
    url: str
    mime_type: str | None = None
    bitrate_kbps: int | None = None
    size_bytes: int | None = None
    is_preferred: bool | None = None


class ContentCreate(BaseModel):
    id: str | None = None
    kind: ContentKind
    title: str = Field(..., min_length=1, max_length=512)
    title_romanized: str | None = None
    subtitle: str | None = None
    artist: str = Field(..., min_length=1, max_length=255)
    artists: list[str] | None = None
    album: str | None = None
    cover_image_url: str | None = None
    backdrop_image_url: str | None = None
    genre: str | None = None
    normalized_genre: str | None = None
    tags: list[str] | None = None
    language: str | None = Field(default=None, pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    release_year: int | None = Field(default=None, ge=1900, le=2100)
    release_date: str | None = None
    duration_sec: float | None = None
    track_number: int | None = None
    total_tracks: int | None = None
    disc_number: int | None = None
    sources: list[AudioSourceSchema] = Field(..., min_length=1)
    source_url: str | None = None
    source: ContentSource
    source_id: str | None = None
    source_cover_url: str | None = None
    description_html: str | None = None
    description_text: str | None = None
    author: str | None = None
    published_at: str | None = None
    like_count: int = 0
    dislike_count: int = 0
    comment_count: int = 0
    view_count: int = 0
    is_curated: bool = False
    is_featured: bool = False
    is_hidden: bool = False
    classifier_confidence: float | None = None
    classifier_method: Literal["heuristic", "tfjs", "manual", "source"] | None = None
    feature_vector: list[float] | None = None


class ContentUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    cover_image_url: str | None = None
    genre: str | None = None
    normalized_genre: str | None = None
    tags: list[str] | None = None
    language: str | None = None
    release_year: int | None = None
    is_curated: bool | None = None
    is_featured: bool | None = None
    is_hidden: bool | None = None


class ContentOut(ContentCreate):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
