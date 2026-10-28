from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from app.api.deps import get_app_settings
from app.core.auth import COOKIE_NAME, create_session_token, valid_password, valid_session_token
from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.common import ApiResponse, ok

router = APIRouter(prefix="/auth", tags=["auth"])
Config = Annotated[Settings, Depends(get_app_settings)]


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class SessionResult(BaseModel):
    authenticated: bool


@router.post("/login", response_model=ApiResponse[SessionResult])
async def login(
    request: LoginRequest, response: Response, settings: Config
) -> ApiResponse[SessionResult]:
    if settings.auth_required and not valid_password(request.password, settings):
        raise AppError("INVALID_CREDENTIALS", "비밀번호가 올바르지 않습니다.", 401)
    token = create_session_token(settings) if settings.auth_required else "demo"
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.auth_session_seconds,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )
    return ok(SessionResult(authenticated=True))


@router.get("/session", response_model=ApiResponse[SessionResult])
async def session(request: Request, settings: Config) -> ApiResponse[SessionResult]:
    authenticated = not settings.auth_required or valid_session_token(
        request.cookies.get(COOKIE_NAME), settings
    )
    if not authenticated:
        raise AppError("AUTH_REQUIRED", "로그인이 필요합니다.", 401)
    return ok(SessionResult(authenticated=authenticated))


@router.post("/logout", response_model=ApiResponse[SessionResult])
async def logout(response: Response) -> ApiResponse[SessionResult]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return ok(SessionResult(authenticated=False))
