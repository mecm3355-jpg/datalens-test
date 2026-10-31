"""Resend HTTP API를 이용한 비밀번호 재설정 메일 발송."""

import asyncio
import html
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.core.errors import AppError

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _deliver(settings: Settings, recipient: str, token: str) -> None:
    """동기 HTTP 요청으로 재설정 메일을 보낸다."""
    if not settings.password_reset_delivery_configured():
        raise AppError(
            "PASSWORD_RESET_DELIVERY_NOT_CONFIGURED",
            "비밀번호 재설정 메일 설정이 없습니다. 관리자에게 문의해 주세요.",
            503,
        )
    assert settings.resend_api_key is not None
    assert settings.password_reset_from is not None
    query = urlencode({"token": token})
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?{query}"
    safe_url = html.escape(reset_url, quote=True)
    payload = json.dumps(
        {
            "from": settings.password_reset_from,
            "to": [recipient],
            "subject": "DataLens 비밀번호 재설정",
            "html": (
                "<p>DataLens 비밀번호 재설정을 요청하셨습니다.</p>"
                f'<p><a href="{safe_url}">비밀번호 재설정하기</a></p>'
                "<p>요청하지 않았다면 이 메일을 무시하세요.</p>"
            ),
        }
    ).encode("utf-8")
    request = Request(
        RESEND_ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=15) as response:  # noqa: S310 - 고정 HTTPS 엔드포인트
            if response.status >= 300:
                raise AppError(
                    "PASSWORD_RESET_DELIVERY_FAILED", "재설정 메일을 보내지 못했습니다.", 502
                )
    except (HTTPError, URLError, TimeoutError) as exc:
        raise AppError(
            "PASSWORD_RESET_DELIVERY_FAILED", "재설정 메일을 보내지 못했습니다.", 502
        ) from exc


async def send_password_reset(settings: Settings, recipient: str, token: str) -> None:
    """이벤트 루프를 막지 않고 재설정 메일을 보낸다."""
    await asyncio.to_thread(_deliver, settings, recipient, token)
