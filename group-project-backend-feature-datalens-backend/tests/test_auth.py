from pathlib import Path

import pytest
from pydantic import SecretStr

from app.core.auth import create_session_token, valid_password, valid_session_token
from app.core.config import Settings
from tests.conftest import make_settings


def auth_settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path).model_copy(
        update={
            "auth_required": True,
            "auth_password": SecretStr("correct-password"),
            "auth_secret": SecretStr("a-long-random-test-secret-32-bytes"),
            "auth_session_seconds": 60,
        }
    )


def test_signed_session_and_password(tmp_path: Path) -> None:
    settings = auth_settings(tmp_path)
    token = create_session_token(settings)
    assert valid_session_token(token, settings)
    assert not valid_session_token(f"{token}tampered", settings)
    assert valid_password("correct-password", settings)
    assert not valid_password("wrong-password", settings)


def test_auth_required_rejects_missing_or_weak_secrets() -> None:
    with pytest.raises(ValueError, match="AUTH_PASSWORD"):
        Settings(
            mongodb_uri="mongodb://example",
            auth_required=True,
            auth_password="short",
            auth_secret="x" * 32,
        )
    with pytest.raises(ValueError, match="AUTH_SECRET"):
        Settings(
            mongodb_uri="mongodb://example",
            auth_required=True,
            auth_password="long-enough-password",
            auth_secret="short",
        )
