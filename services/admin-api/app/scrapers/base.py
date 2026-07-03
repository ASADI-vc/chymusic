"""Scraper base class — common interface for all source-specific scrapers."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings
from app.schemas.content import ContentCreate


@dataclass
class ScraperResult:
    items: list[ContentCreate] = field(default_factory=list)
    log: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class Scraper(abc.ABC):
    """Subclass per source website. Implement `scrape()`."""

    name: str = "base"

    def __init__(self, max_items: int = 100, target_url: str | None = None) -> None:
        self.max_items = max_items
        self.target_url = target_url
        self.client = httpx.AsyncClient(
            timeout=settings.scraper_request_timeout_sec,
            headers={"User-Agent": settings.scraper_user_agent},
            follow_redirects=True,
        )

    @abc.abstractmethod
    async def scrape(self) -> ScraperResult:
        """Run the scraper. Returns a list of ContentCreate candidates."""

    async def fetch(self, url: str) -> str:
        """Fetch a URL and return its HTML."""
        resp = await self.client.get(url)
        resp.raise_for_status()
        return resp.text

    async def fetch_soup(self, url: str) -> BeautifulSoup:
        return BeautifulSoup(await self.fetch(url), "lxml")

    async def aclose(self) -> None:
        await self.client.aclose()

    @staticmethod
    def normalize_text(s: str | None) -> str:
        if not s:
            return ""
        return " ".join(s.split()).strip()
