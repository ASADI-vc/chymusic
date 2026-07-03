"""Collection model — albums, podcast series, noheh albums, speech series."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Collection(Base):
    __tablename__ = "collection"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    title_romanized: Mapped[str | None] = mapped_column(String(512), nullable=True)
    artist_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("artist.id"), nullable=True
    )
    artist_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(128), nullable=True)
    normalized_genre: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    total_tracks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_curated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    contents: Mapped[list["Content"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="collection_rel", foreign_keys="Content.collection_id"
    )
