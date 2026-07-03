"""Catalog export routes — generate + serve paginated JSON for the standalone PWA."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.user import AdminUser
from app.services.exporter import export_catalog

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.post("/export")
def trigger_export(
    db: Session = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
) -> dict:
    """Regenerate the catalog JSON files. Returns the manifest."""
    out_dir = export_catalog(db)
    return {
        "status": "ok",
        "export_dir": str(out_dir),
        "manifest_url": "/api/v1/catalog/manifest.json",
    }


@router.get("/manifest.json")
async def get_manifest() -> JSONResponse:
    """Public endpoint — the PWA calls this to discover how many pages exist."""
    manifest_path = settings.exports_dir / "catalog" / "manifest.json"
    if not manifest_path.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "Catalog has not been exported yet. An admin must trigger /export first."},
        )
    import json

    return JSONResponse(content=json.loads(manifest_path.read_text(encoding="utf-8")))


@router.get("/page-{page}.json")
async def get_page(page: int) -> FileResponse:
    """Public endpoint — serves a single catalog page."""
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    file = settings.exports_dir / "catalog" / f"page-{page}.json"
    if not file.exists():
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(file, media_type="application/json")
