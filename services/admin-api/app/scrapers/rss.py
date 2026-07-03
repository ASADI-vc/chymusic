"""RSS feed scraper — for podcasts."""

from __future__ import annotations

from xml.etree import ElementTree as ET

from app.scrapers.base import Scraper, ScraperResult
from app.schemas.content import AudioSourceSchema, ContentCreate


class RssScraper(Scraper):
    name = "rss_feed"

    async def scrape(self) -> ScraperResult:
        result = ScraperResult()
        if not self.target_url:
            result.errors.append("RSS scraper requires target_url")
            return result

        try:
            text = await self.fetch(self.target_url)
            root = ET.fromstring(text)
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"RSS parse failed: {exc!r}")
            return result

        # Strip XML namespaces for simplicity.
        for elem in root.iter():
            if "}" in elem.tag:
                elem.tag = elem.tag.split("}", 1)[1]

        channel = root.find("channel")
        if channel is None:
            result.errors.append("No <channel> in feed")
            return result

        podcast_title = self.normalize_text(channel.findtext("title"))
        podcast_author = self.normalize_text(
            channel.findtext("itunes:author") or channel.findtext("author") or "Unknown"
        )

        for item in channel.findall("item")[: self.max_items]:
            title = self.normalize_text(item.findtext("title"))
            enclosure = item.find("enclosure")
            if not title or not enclosure or not enclosure.get("url"):
                continue

            pub_date = item.findtext("pubDate")
            duration = item.findtext("itunes:duration")

            result.items.append(
                ContentCreate(
                    kind="podcast",
                    title=title,
                    artist=podcast_author,
                    album=podcast_title,
                    sources=[
                        AudioSourceSchema(
                            type="remote",
                            url=enclosure.get("url") or "",
                            mime_type=enclosure.get("type") or "audio/mpeg",
                        )
                    ],
                    source="rss_feed",
                    source_url=item.findtext("link") or self.target_url,
                    published_at=pub_date,
                    duration_sec=float(duration) if duration else None,
                    description_text=self.normalize_text(item.findtext("description")),
                )
            )

        return result
