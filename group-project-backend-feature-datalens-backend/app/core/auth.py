"""공개 데모 배포를 보호하는 단일 운영자 세션 인증."""

import base64
import hashlib
import hmac
import json
import time

from app.core.config import Settings
from app.core.errors import AppError

COOKIE_NAME = "datalens_session"


def _secret(settings: Settings) -> bytes:
    if settings.auth_secret is None:
        raise AppError("AUTH_NOT_CONFIGURED", "AUTH_SECRET이 설정되지 않았습니다.", 503)
    return settings.auth_secret.get_secret_value().encode()


def create_session_token(settings: Settings) -> str:
    """만료 시각을 담은 서명 토큰을 만든다."""
    payload = json.dumps(
        {"exp": int(time.time()) + settings.auth_session_seconds}, separators=(",", ":")
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(_secret(settings), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def valid_session_token(token: str | None, settings: Settings) -> bool:
    """서명과 만료 시각을 확인한다. 잘못된 입력은 예외 대신 False다."""
    if not token or "." not in token:
        return False
    encoded, signature = token.rsplit(".", 1)
    expected = hmac.new(_secret(settings), encoded.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return False
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        return isinstance(payload, dict) and int(payload.get("exp", 0)) > int(time.time())
    except (ValueError, TypeError, json.JSONDecodeError):
        return False


def valid_password(password: str, settings: Settings) -> bool:
    """운영 비밀번호를 timing-safe 비교한다."""
    if settings.auth_password is None:
        raise AppError("AUTH_NOT_CONFIGURED", "AUTH_PASSWORD가 설정되지 않았습니다.", 503)
    return hmac.compare_digest(password, settings.auth_password.get_secret_value())
