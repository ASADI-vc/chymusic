"""Content model — the central entity, mirrors @chymusic/shared Content type.

Stores music, podcasts, madahi, and speech in one table with a `kind`
discriminator. Flexible enough to add new kinds without migrations.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Content(Base):
    __tablename__ = "content"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    title_romanized: Mapped[str | None] = mapped_column(String(512), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(512), nullable=True)
    artist: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    artists_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    album: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    backdrop_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(128), nullable=True)
    normalized_genre: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    release_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    track_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tracks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disc_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sources_json: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_cover_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    description_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_curated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    classifier_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    classifier_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    feature_vector_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    artist_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("artist.id"), nullable=True
    )
    collection_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("collection.id"), nullable=True
    )

    artist_rel: Mapped["Artist | None"] = relationship(back_populates="contents")  # type: ignore[name-defined]  # noqa: F821
    collection_rel: Mapped["Collection | None"] = relationship(back_populates="contents")  # type: ignore[name-defined]  # noqa: F821
