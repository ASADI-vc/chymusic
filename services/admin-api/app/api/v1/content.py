"""Content CRUD routes — admin manages scraped content here."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.content import Content
from app.models.user import AdminUser
from app.schemas.content import ContentCreate, ContentOut, ContentUpdate
from app.services.cleaner import clean_content
from app.services.classifier import classify_content

router = APIRouter(prefix="/content", tags=["content"])


def _serialize(c: Content) -> ContentOut:
    return ContentOut.model_validate(
        {
            **{k: getattr(c, k) for k in ContentOut.model_fields.keys() if hasattr(c, k)},
            "artists": json.loads(c.artists_json) if c.artists_json else None,
            "tags": json.loads(c.tags_json) if c.tags_json else None,
            "sources": json.loads(c.sources_json),
            "feature_vector": json.loads(c.feature_vector_json) if c.feature_vector_json else None,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
    )


@router.get("", response_model=list[ContentOut])
def list_content(
    kind: str | None = None,
    source: str | None = None,
    is_curated: bool | None = None,
    is_featured: bool | None = None,
    is_hidden: bool | None = None,
    q: str | None = None,
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> list[ContentOut]:
    stmt = select(Content)
    if kind:
        stmt = stmt.where(Content.kind == kind)
    if source:
        stmt = stmt.where(Content.source == source)
    if is_curated is not None:
        stmt = stmt.where(Content.is_curated == is_curated)
    if is_featured is not None:
        stmt = stmt.where(Content.is_featured == is_featured)
    if is_hidden is not None:
        stmt = stmt.where(Content.is_hidden == is_hidden)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Content.title.ilike(like) | Content.artist.ilike(like))

    stmt = stmt.order_by(Content.created_at.desc()).limit(limit).offset(offset)
    return [_serialize(c) for c in db.execute(stmt).scalars()]


@router.post("", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
def create_content(
    body: ContentCreate,
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> ContentOut:
    body = clean_content(body)
    if not body.normalized_genre:
        genre, conf, method = classify_content(body)
        body.normalized_genre = genre
        body.classifier_confidence = conf
        body.classifier_method = method

    now = datetime.now(UTC).isoformat()
    content = Content(
        id=body.id or str(uuid.uuid4()),
        kind=body.kind,
        title=body.title,
        title_romanized=body.title_romanized,
        subtitle=body.subtitle,
        artist=body.artist,
        artists_json=json.dumps(body.artists) if body.artists else None,
        album=body.album,
        cover_image_url=body.cover_image_url,
        backdrop_image_url=body.backdrop_image_url,
        genre=body.genre,
        normalized_genre=body.normalized_genre,
        tags_json=json.dumps(body.tags) if body.tags else None,
        language=body.language,
        release_year=body.release_year,
        release_date=body.release_date,
        duration_sec=body.duration_sec,
        track_number=body.track_number,
        total_tracks=body.total_tracks,
        disc_number=body.disc_number,
        sources_json=json.dumps([s.model_dump() for s in body.sources]),
        source_url=body.source_url,
        source=body.source,
        source_id=body.source_id,
        source_cover_url=body.source_cover_url,
        description_html=body.description_html,
        description_text=body.description_text,
        author=body.author,
        published_at=body.published_at,
        like_count=body.like_count,
        dislike_count=body.dislike_count,
        comment_count=body.comment_count,
        view_count=body.view_count,
        is_curated=body.is_curated,
        is_featured=body.is_featured,
        is_hidden=body.is_hidden,
        classifier_confidence=body.classifier_confidence,
        classifier_method=body.classifier_method,
        feature_vector_json=json.dumps(body.feature_vector) if body.feature_vector else None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(content)
    db.commit()
    db.refresh(content)
    return _serialize(content)


@router.patch("/{content_id}", response_model=ContentOut)
def update_content(
    content_id: str,
    body: ContentUpdate,
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> ContentOut:
    content = db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if k == "tags":
            content.tags_json = json.dumps(v) if v else None
        else:
            setattr(content, k, v)
    content.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(content)
    return _serialize(content)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(
    content_id: str,
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> None:
    content = db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(content)
    db.commit()


@router.get("/stats")
def content_stats(
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> dict:
    total = db.scalar(select(func.count(Content.id))) or 0
    by_kind = dict(
        db.execute(
            select(Content.kind, func.count(Content.id)).group_by(Content.kind)
        ).all()
    )
    by_source = dict(
        db.execute(
            select(Content.source, func.count(Content.id)).group_by(Content.source)
        ).all()
    )
    featured = db.scalar(select(func.count(Content.id)).where(Content.is_featured == True)) or 0  # noqa: E712
    curated = db.scalar(select(func.count(Content.id)).where(Content.is_curated == True)) or 0  # noqa: E712
    hidden = db.scalar(select(func.count(Content.id)).where(Content.is_hidden == True)) or 0  # noqa: E712
    return {
        "total": total,
        "by_kind": by_kind,
        "by_source": by_source,
        "featured": featured,
        "curated": curated,
        "hidden": hidden,
    }
