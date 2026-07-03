"""FastAPI application factory."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.content import router as content_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.scrape import router as scrape_router
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.core.security import hash_password
from app.models.user import AdminUser


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Startup + shutdown hooks."""
    init_db()

    # Bootstrap admin user if no users exist.
    db = SessionLocal()
    try:
        if db.query(AdminUser).count() == 0:
            db.add(
                AdminUser(
                    id=str(uuid.uuid4()),
                    username=settings.bootstrap_admin_username,
                    hashed_password=hash_password(settings.bootstrap_admin_password),
                    is_superadmin=True,
                    is_active=True,
                )
            )
            db.commit()
            print(
                f"[CHYMUSIC] Bootstrapped admin user '{settings.bootstrap_admin_username}' "
                f"with default password. CHANGE IT IMMEDIATELY."
            )
    finally:
        db.close()

    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="CHYMUSIC Admin API",
        version="0.1.0",
        description="Admin back-office for the CHYMUSIC platform: scrapers, data cleaning, catalog export.",
        lifespan=lifespan,
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api_prefix = "/api/v1"
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(content_router, prefix=api_prefix)
    app.include_router(scrape_router, prefix=api_prefix)
    app.include_router(catalog_router, prefix=api_prefix)
    app.include_router(ingest_router, prefix=api_prefix)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok", "environment": settings.environment, "version": "0.1.0"}

    return app


app = create_app()
