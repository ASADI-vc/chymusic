"""Auth routes — login, logout, whoami."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.security import create_access_token, verify_password
from app.models.user import AdminUser
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(AdminUser).where(AdminUser.username == body.username))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_login_at = datetime.now(UTC)
    db.commit()

    token = create_access_token(
        subject=user.id,
        extra={"username": user.username, "is_superadmin": user.is_superadmin},
    )
    return LoginResponse(
        access_token=token,
        username=user.username,
        is_superadmin=user.is_superadmin,
    )


@router.get("/me")
def me(user: AdminUser = Depends(get_current_user)) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_superadmin": user.is_superadmin,
        "is_active": user.is_active,
    }
