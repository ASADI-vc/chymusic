"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CHYMUSIC_",
        case_sensitive=False,
        extra="ignore",
    )

    # ----- Core -----
    environment: Literal["dev", "staging", "prod"] = "dev"
    debug: bool = True
    log_level: str = "INFO"

    # ----- Server -----
    host: str = "0.0.0.0"
    port: int = 8001
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",  # admin-ui dev (Vite proxy is enough but kept for safety)
        ]
    )

    # ----- Database -----
    # SQLite by default — switch to postgres://... for production.
    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[2] / 'data' / 'admin.sqlite'}"

    # ----- Auth -----
    # Generate with: openssl rand -hex 32
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24  # 24h
    # Default admin credentials (only used on first run to bootstrap the DB).
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "changeme"

    # ----- Storage -----
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"
    raw_dir: Path = Path(__file__).resolve().parents[2] / "data" / "raw"
    processed_dir: Path = Path(__file__).resolve().parents[2] / "data" / "processed"
    exports_dir: Path = Path(__file__).resolve().parents[2] / "data" / "exports"

    # ----- Scrapers -----
    scraper_user_agent: str = (
        "Mozilla/5.0 (compatible; CHYMUSIC-admin/0.1; +https://github.com/ASADI-vc/chymusic)"
    )
    scraper_concurrency: int = 4
    scraper_request_timeout_sec: int = 30
    scraper_delay_sec: float = 0.5

    # ----- Catalog export -----
    catalog_page_size: int = 200

    # ----- Extension ingest (received from the user's browser extension) -----
    # When the user opts in to push scraped data back to the admin server.
    extension_ingest_enabled: bool = True
    extension_ingest_api_key: str = "CHANGE_ME"


settings = Settings()  # type: ignore[call-arg]

# Ensure data directories exist.
for d in (settings.data_dir, settings.raw_dir, settings.processed_dir, settings.exports_dir):
    d.mkdir(parents=True, exist_ok=True)
