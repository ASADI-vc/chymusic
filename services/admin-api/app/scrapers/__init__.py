"""Scrapers package — one module per source website."""

from app.scrapers.base import Scraper, ScraperResult
from app.scrapers.kashoob import KashoobScraper
from app.scrapers.musicsbaran import MusicsbaranScraper
from app.scrapers.rss import RssScraper

REGISTRY: dict[str, type[Scraper]] = {
    "musicsbaran": MusicsbaranScraper,
    "kashoob": KashoobScraper,
    "rss_feed": RssScraper,
}

__all__ = ["REGISTRY", "Scraper", "ScraperResult", "MusicsbaranScraper", "KashoobScraper", "RssScraper"]
