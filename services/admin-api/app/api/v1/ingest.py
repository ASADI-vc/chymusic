"""Extension ingest endpoint — receives scraped data pushed from the browser extension.

The standalone PWA can optionally POST extension-scraped content back to the
admin server (if the user opts in via Settings). This endpoint accepts those
pushes and stores them as 'extension_scrape' source content for admin review.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models.content import Content
from app.schemas.content import ContentCreate

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def ingest_from_extension(
    items: list[ContentCreate],
    x_chymusic_api_key: str = Header(..., alias="X-CHYMUSIC-API-Key"),
    db: Session = Depends(get_db),
) -> dict:
    if not settings.extension_ingest_enabled:
        raise HTTPException(status_code=503, detail="Extension ingest is disabled")
    if x_chymusic_api_key != settings.extension_ingest_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    inserted = 0
    updated = 0
    errors: list[dict] = []

    for item in items:
        try:
            # Dedup by source_url + source.
            existing = None
            if item.source_url:
                existing = db.query(Content).filter_by(source_url=item.source_url).first()

            now = datetime.now(UTC)
            if existing:
                existing.title = item.title
                existing.artist = item.artist
                existing.album = item.album
                existing.cover_image_url = item.cover_image_url
                existing.sources_json = json.dumps([s.model_dump() for s in item.sources])
                existing.updated_at = now
                updated += 1
            else:
                c = Content(
                    id=str(uuid.uuid4()),
                    kind=item.kind,
                    title=item.title,
                    artist=item.artist,
                    album=item.album,
                    cover_image_url=item.cover_image_url,
                    sources_json=json.dumps([s.model_dump() for s in item.sources]),
                    source=item.source,
                    source_url=item.source_url,
                    description_text=item.description_text,
                    is_curated=False,
                    is_featured=False,
                    is_hidden=False,
                    created_at=now,
                    updated_at=now,
                )
                db.add(c)
                inserted += 1
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            errors.append({"url": item.source_url, "error": str(exc)})

    return {"inserted": inserted, "updated": updated, "errors": errors}
