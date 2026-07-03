"""Kashoob.com scraper — Madahi (Noheh) source."""

from __future__ import annotations

from urllib.parse import urljoin

from app.scrapers.base import Scraper, ScraperResult
from app.schemas.content import AudioSourceSchema, ContentCreate


class KashoobScraper(Scraper):
    name = "kashoob"
    BASE_URL = "https://kashoob.com"

    async def scrape(self) -> ScraperResult:
        result = ScraperResult()
        album_urls = await self._discover_album_urls()
        result.log.append(f"Discovered {len(album_urls)} noheh albums")

        for url in album_urls[: self.max_items]:
            try:
                content = await self._scrape_album(url)
                if content:
                    result.items.append(content)
            except Exception as exc:  # noqa: BLE001
                result.errors.append(f"{url}: {exc!r}")

        return result

    async def _discover_album_urls(self) -> list[str]:
        if self.target_url:
            return [self.target_url]

        urls: list[str] = []
        for page in range(1, 10):
            if len(urls) >= self.max_items:
                break
            soup = await self.fetch_soup(f"{self.BASE_URL}/category/noheh/page/{page}/")
            for a in soup.select("h2 a, .entry-title a, .post-title a"):
                href = a.get("href")
                if href and href.startswith("http"):
                    urls.append(href)
        return urls

    async def _scrape_album(self, url: str) -> ContentCreate | None:
        soup = await self.fetch_soup(url)

        title = self.normalize_text(soup.select_one("h1.entry-title, h1")?.text)
        if not title:
            return None

        artist = self.normalize_text(
            soup.select_one(".nohe-maddah, .maddah-name, .artist-name")?.text
        )

        cover = soup.select_one(".nohe-cover img, .album-cover img")
        cover_url = cover.get("src") if cover else None

        sources: list[AudioSourceSchema] = []
        for li in soup.select(".nohe-list li, .track-list li, .audio-list li"):
            link = li.select_one("a[href$='.mp3'], a.download")
            if link and link.get("href"):
                sources.append(
                    AudioSourceSchema(
                        type="remote",
                        url=urljoin(self.BASE_URL, link["href"]),
                        mime_type="audio/mpeg",
                    )
                )

        if not sources:
            return None

        return ContentCreate(
            kind="madahi",
            title=title,
            artist=artist or "Unknown",
            album=title,
            cover_image_url=cover_url,
            genre="noheh",
            normalized_genre="noheh",
            sources=sources,
            source="kashoob",
            source_url=url,
            source_cover_url=cover_url,
            description_text=self.normalize_text(
                soup.select_one(".entry-content, .post-content")?.text
            ),
        )
