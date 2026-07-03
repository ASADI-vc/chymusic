"""ScrapeJob + ScrapeJobItem — track scraper runs and per-item outcomes."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ScrapeJob(Base):
    __tablename__ = "scrape_job"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scraper: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )  # pending, running, completed, failed, cancelled
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    target_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    items_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_success: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )

    items: Mapped[list["ScrapeJobItem"]] = relationship(back_populates="job")


class ScrapeJobItem(Base):
    __tablename__ = "scrape_job_item"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scrape_job.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )

    job: Mapped["ScrapeJob"] = relationship(back_populates="items")
