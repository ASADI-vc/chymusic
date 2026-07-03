"""Scrape routes — trigger and monitor scraper jobs."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db, SessionLocal
from app.models.scrape_job import ScrapeJob
from app.models.user import AdminUser
from app.schemas.content import ContentCreate
from app.schemas.scrape import ScrapeJobOut, ScrapeRequest
from app.scrapers import REGISTRY
from app.services.cleaner import clean_content
from app.services.classifier import classify_content
from app.models.content import Content
import json

router = APIRouter(prefix="/scrape", tags=["scrape"])


async def _run_scrape_job(job_id: str, req: ScrapeRequest) -> None:
    """Background task that runs the scraper and stores results."""
    db = SessionLocal()
    try:
        job = db.get(ScrapeJob, job_id)
        if not job:
            return

        job.status = "running"
        job.started_at = datetime.now(UTC)
        db.commit()

        scraper_cls = REGISTRY.get(req.scraper)
        if not scraper_cls:
            job.status = "failed"
            job.log = f"Unknown scraper: {req.scraper}"
            db.commit()
            return

        scraper = scraper_cls(
            max_items=req.max_items or 100,
            target_url=req.target_url,
        )

        try:
            result = await scraper.scrape()
        finally:
            await scraper.aclose()

        job.items_total = len(result.items)
        job.log = "\n".join(result.log)

        for item in result.items:
            try:
                if req.clean:
                    item = clean_content(item)
                if req.classify and not item.normalized_genre:
                    genre, conf, method = classify_content(item)
                    item.normalized_genre = genre
                    item.classifier_confidence = conf
                    item.classifier_method = method

                # Upsert into content table.
                existing = None
                if item.source_id:
                    existing = db.query(Content).filter_by(source=item.source, source_id=item.source_id).first()
                if not existing and item.source_url:
                    existing = db.query(Content).filter_by(source_url=item.source_url).first()

                now = datetime.now(UTC)
                if existing:
                    # Update fields.
                    existing.title = item.title
                    existing.artist = item.artist
                    existing.album = item.album
                    existing.cover_image_url = item.cover_image_url
                    existing.sources_json = json.dumps([s.model_dump() for s in item.sources])
                    existing.normalized_genre = item.normalized_genre
                    existing.classifier_confidence = item.classifier_confidence
                    existing.classifier_method = item.classifier_method
                    existing.updated_at = now
                else:
                    c = Content(
                        id=str(uuid.uuid4()),
                        kind=item.kind,
                        title=item.title,
                        artist=item.artist,
                        album=item.album,
                        cover_image_url=item.cover_image_url,
                        genre=item.genre,
                        normalized_genre=item.normalized_genre,
                        sources_json=json.dumps([s.model_dump() for s in item.sources]),
                        source=item.source,
                        source_url=item.source_url,
                        source_id=item.source_id,
                        description_text=item.description_text,
                        published_at=item.published_at,
                        classifier_confidence=item.classifier_confidence,
                        classifier_method=item.classifier_method,
                        is_curated=False,
                        is_featured=False,
                        is_hidden=False,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(c)
                db.commit()
                job.items_success += 1
            except Exception:  # noqa: BLE001
                db.rollback()
                job.items_failed += 1

        job.status = "completed"
        job.finished_at = datetime.now(UTC)
        db.commit()
    finally:
        db.close()


@router.post("", response_model=ScrapeJobOut, status_code=202)
def start_scrape(
    body: ScrapeRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> ScrapeJobOut:
    if body.scraper not in REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown scraper: {body.scraper}")

    job = ScrapeJob(
        id=str(uuid.uuid4()),
        scraper=body.scraper,
        status="pending",
        target_url=body.target_url,
        items_total=0,
        items_success=0,
        items_failed=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    bg.add_task(asyncio.run, _run_scrape_job(job.id, body))
    return ScrapeJobOut.model_validate(job)


@router.get("/{job_id}", response_model=ScrapeJobOut)
def get_scrape_status(
    job_id: str,
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> ScrapeJobOut:
    job = db.get(ScrapeJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScrapeJobOut.model_validate(job)


@router.get("", response_model=list[ScrapeJobOut])
def list_scrape_jobs(
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> list[ScrapeJobOut]:
    from sqlalchemy import select

    jobs = db.execute(select(ScrapeJob).order_by(ScrapeJob.created_at.desc()).limit(50)).scalars().all()
    return [ScrapeJobOut.model_validate(j) for j in jobs]
