"""Musicsbaran.ir scraper.

The site is a Persian-music WordPress blog with album posts. Each post has:
  - h1.entry-title = album title
  - .album-artist = artist
  - .track-list li = individual tracks with download links
  - .album-cover img = cover image
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from app.scrapers.base import Scraper, ScraperResult
from app.schemas.content import AudioSourceSchema, ContentCreate


class MusicsbaranScraper(Scraper):
    name = "musicsbaran"
    BASE_URL = "https://musicsbaran.ir"

    async def scrape(self) -> ScraperResult:
        result = ScraperResult()

        # If a target URL is given, scrape that specific album.
        # Otherwise, scrape the latest-albums listing.
        album_urls = await self._discover_album_urls()

        result.log.append(f"Discovered {len(album_urls)} albums")

        for url in album_urls[: self.max_items]:
            try:
                content = await self._scrape_album(url)
                if content:
                    result.items.append(content)
                    result.log.append(f"OK: {url}")
            except Exception as exc:  # noqa: BLE001
                result.errors.append(f"{url}: {exc!r}")
                result.log.append(f"ERR: {url}: {exc!r}")

        return result

    async def _discover_album_urls(self) -> list[str]:
        if self.target_url:
            return [self.target_url]

        urls: list[str] = []
        # Walk the latest-albums pages until we have enough.
        for page in range(1, 20):
            if len(urls) >= self.max_items:
                break
            soup = await self.fetch_soup(f"{self.BASE_URL}/page/{page}/")
            for a in soup.select("h2 a, .album-title a, .entry-title a"):
                href = a.get("href")
                if href and href.startswith("http"):
                    urls.append(href)
        return urls

    async def _scrape_album(self, url: str) -> ContentCreate | None:
        soup = await self.fetch_soup(url)

        title = self.normalize_text(soup.select_one("h1.entry-title, .album-title")?.text)
        artist = self.normalize_text(soup.select_one(".album-artist, .artist-name")?.text)
        if not title:
            return None

        cover_img = soup.select_one(".album-cover img, .album-img img")
        cover_url = cover_img.get("src") if cover_img else None

        # Tracks
        sources: list[AudioSourceSchema] = []
        track_titles: list[str] = []
        for li in soup.select(".track-list li, .songs-list li"):
            t = self.normalize_text(li.select_one(".track-title, .song-title")?.text)
            if t:
                track_titles.append(t)
            link = li.select_one("a[href*='dl.'], a.download-link, a[href$='.mp3']")
            if link and link.get("href"):
                sources.append(
                    AudioSourceSchema(
                        type="remote",
                        url=urljoin(self.BASE_URL, link["href"]),
                        mime_type="audio/mpeg",
                    )
                )

        # If no per-track sources found, look for a single album-zip download.
        if not sources:
            zip_link = soup.select_one("a[href$='.zip'], a.zip-download")
            if zip_link and zip_link.get("href"):
                sources.append(
                    AudioSourceSchema(
                        type="remote",
                        url=urljoin(self.BASE_URL, zip_link["href"]),
                        mime_type="application/zip",
                    )
                )

        if not sources:
            return None

        # Genre / tags — best-effort extraction from category links.
        genre = None
        for cat in soup.select(".entry-category a, .post-categories a"):
            genre = self.normalize_text(cat.text)
            break

        release_year = None
        date_text = soup.select_one("time.entry-date, .post-date")?.text
        if date_text:
            m = re.search(r"\b(19|20)\d{2}\b", date_text)
            if m:
                release_year = int(m.group(0))

        # Track index 0 = album as a whole (for single-source entries).
        # Future iteration: emit one ContentCreate per track.
        return ContentCreate(
            kind="music",
            title=title,
            artist=artist or "Unknown",
            album=title,
            cover_image_url=cover_url,
            genre=genre,
            release_year=release_year,
            sources=sources,
            source="musicsbaran",
            source_url=url,
            source_id=self._extract_post_id(soup),
            source_cover_url=cover_url,
            description_text=self.normalize_text(
                soup.select_one(".entry-content, .post-content")?.text
            ),
            author=self.normalize_text(soup.select_one(".author, .post-author")?.text),
            published_at=soup.select_one("time.entry-date")?.get("datetime"),
        )

    @staticmethod
    def _extract_post_id(soup) -> str | None:  # type: ignore[no-untyped-def]
        body = soup.select_one("body")
        if body:
            classes = body.get("class", []) or []
            for c in classes:
                m = re.match(r"postid-(\d+)", c)
                if m:
                    return m.group(1)
        return None
