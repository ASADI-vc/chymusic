"""Scrape schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ScrapeKind = Literal["musicsbaran", "kashoob", "rss_feed", "custom"]


class ScrapeRequest(BaseModel):
    scraper: ScrapeKind
    target_url: str | None = None
    max_items: int | None = 100
    clean: bool = True
    classify: bool = True


class ScrapeStatus(BaseModel):
    job_id: str
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    items_total: int
    items_success: int
    items_failed: int
    started_at: datetime | None
    finished_at: datetime | None


class ScrapeJobOut(ScrapeStatus):
    scraper: str
    target_url: str | None
    log: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
