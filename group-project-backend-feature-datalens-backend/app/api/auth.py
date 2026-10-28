from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from app.api.deps import get_app_settings
from app.core.auth import COOKIE_NAME
from app.core.config import Settings
from app.core.database import Mongo, get_mongo
from app.core.errors import AppError
from app.schemas.common import ApiModel, ApiResponse, ok
from app.schemas.user import UserDocument
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
Config = Annotated[Settings, Depends(get_app_settings)]


def get_auth_service(mongo: Annotated[Mongo, Depends(get_mongo)], settings: Config) -> AuthService:
    """현재 DB와 설정으로 인증 서비스를 만든다.

    파라미터:
        mongo: 앱이 공유하는 MongoDB 연결
        settings: 인증 설정
    """
    return AuthService(mongo.db, settings)


Service = Annotated[AuthService, Depends(get_auth_service)]


class SignupRequest(ApiModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    password: str = Field(min_length=10, max_length=128)


class UserResult(ApiModel):
    id: str
    email: str
    display_name: str
    role: Literal["admin", "user"]

    @classmethod
    def from_document(cls, user: UserDocument) -> "UserResult":
        """MongoDB 사용자 문서를 공개 가능한 응답으로 바꾼다.

        파라미터:
            user: 비밀번호 해시를 포함한 내부 사용자 문서
        """
        return cls(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            role=user.role,
        )


class SessionResult(ApiModel):
    authenticated: bool
    user: UserResult | None = None


class PasswordResetResult(ApiModel):
    message: str
    reset_token: str | None = None


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    """보안 속성이 적용된 세션 쿠키를 응답에 설정한다.

    파라미터:
        response: FastAPI 응답
        token: DB에는 해시로만 저장된 원문 세션 토큰
        settings: 쿠키 보안 및 만료 설정
    """
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.auth_session_seconds,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=ApiResponse[SessionResult], status_code=201)
async def signup(
    payload: SignupRequest,
    response: Response,
    service: Service,
    settings: Config,
) -> ApiResponse[SessionResult]:
    """계정을 만들고 즉시 로그인한다."""
    user = await service.signup(payload.email, payload.display_name, payload.password)
    _, token = await service.login(payload.email, payload.password)
    _set_session_cookie(response, token, settings)
    return ok(SessionResult(authenticated=True, user=UserResult.from_document(user)))


@router.post("/login", response_model=ApiResponse[SessionResult])
async def login(
    payload: LoginRequest,
    response: Response,
    service: Service,
    settings: Config,
) -> ApiResponse[SessionResult]:
    """이메일과 비밀번호를 확인하고 새 서버 세션을 발급한다."""
    user, token = await service.login(payload.email, payload.password)
    _set_session_cookie(response, token, settings)
    return ok(SessionResult(authenticated=True, user=UserResult.from_document(user)))


@router.get("/session", response_model=ApiResponse[SessionResult])
async def session(
    request: Request, service: Service, settings: Config
) -> ApiResponse[SessionResult]:
    """현재 세션과 공개 사용자 정보를 반환한다."""
    user = await service.authenticate(request.cookies.get(COOKIE_NAME))
    if user is None and settings.auth_required:
        raise AppError("AUTH_REQUIRED", "로그인이 필요합니다.", 401)
    return ok(
        SessionResult(
            authenticated=user is not None or not settings.auth_required,
            user=None if user is None else UserResult.from_document(user),
        )
    )


@router.post("/logout", response_model=ApiResponse[SessionResult])
async def logout(
    request: Request, response: Response, service: Service, settings: Config
) -> ApiResponse[SessionResult]:
    """현재 서버 세션을 삭제하고 쿠키를 제거한다."""
    await service.logout(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
    )
    return ok(SessionResult(authenticated=False))


@router.post("/password-reset/request", response_model=ApiResponse[PasswordResetResult])
async def request_password_reset(
    payload: PasswordResetRequest, service: Service, settings: Config
) -> ApiResponse[PasswordResetResult]:
    """계정 노출 없이 비밀번호 재설정 요청을 접수한다."""
    if not settings.auth_expose_reset_token:
        raise AppError(
            "PASSWORD_RESET_DELIVERY_NOT_CONFIGURED",
            "비밀번호 재설정 메일 발송이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.",
            503,
        )
    token = await service.request_password_reset(payload.email)
    exposed = token if settings.auth_expose_reset_token else None
    return ok(
        PasswordResetResult(
            message="가입된 이메일이면 비밀번호 재설정 안내를 전송합니다.",
            reset_token=exposed,
        )
    )


@router.post("/password-reset/confirm", response_model=ApiResponse[PasswordResetResult])
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest, service: Service
) -> ApiResponse[PasswordResetResult]:
    """일회용 토큰으로 비밀번호를 바꾸고 기존 세션을 모두 종료한다."""
    await service.reset_password(payload.token, payload.password)
    return ok(PasswordResetResult(message="비밀번호가 변경되었습니다. 다시 로그인해 주세요."))
