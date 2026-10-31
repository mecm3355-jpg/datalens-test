from pathlib import Path
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient
from pydantic import SecretStr
from pymongo import MongoClient

from app.core.auth import (
    hash_password,
    hash_token,
    new_opaque_token,
    normalize_email,
    validate_password,
    verify_password,
)
from app.core.config import Settings
from app.core.database import Document
from app.main import create_app
from app.services.password_reset_delivery import _deliver
from tests.conftest import TEST_URI, make_settings, requires_db


def test_password_hash_and_opaque_token() -> None:
    password_hash = hash_password("safe-password-123")
    assert password_hash.startswith("$argon2id$")
    assert verify_password(password_hash, "safe-password-123")
    assert not verify_password(password_hash, "wrong-password-123")
    assert validate_password("short1") is not None
    assert validate_password("long-password-without-number") is not None
    assert validate_password("safe-password-123") is None
    assert normalize_email("  USER@Example.COM ") == "user@example.com"

    token = new_opaque_token()
    assert token not in hash_token(token)
    assert hash_token(token) == hash_token(token)


def test_auth_settings_reject_unsafe_limits() -> None:
    Settings(_env_file=None, mongodb_uri="mongodb://example")
    try:
        Settings(
            _env_file=None,
            mongodb_uri="mongodb://example",
            auth_max_failed_attempts=2,
        )
    except ValueError as error:
        assert "AUTH_MAX_FAILED_ATTEMPTS" in str(error)
    else:
        raise AssertionError("약한 로그인 제한 설정이 거부되어야 합니다.")
    try:
        Settings(
            _env_file=None,
            mongodb_uri="mongodb://example",
            auth_cookie_samesite="none",
            auth_cookie_secure=False,
        )
    except ValueError as error:
        assert "AUTH_COOKIE_SAMESITE" in str(error)
    else:
        raise AssertionError("SameSite=None 쿠키는 Secure 없이 허용되면 안 됩니다.")


def test_password_reset_delivery_uses_configured_frontend_url(tmp_path: Path) -> None:
    settings = make_settings(
        tmp_path,
        resend_api_key=SecretStr("resend-test-key"),
        password_reset_from="DataLens <no-reply@example.com>",
        frontend_url="https://datalens.example",
    )
    with patch("app.services.password_reset_delivery.urlopen") as send:
        send.return_value.__enter__.return_value.status = 200
        _deliver(settings, "user@example.com", "secret-token")
    request = send.call_args.args[0]
    assert request.full_url == "https://api.resend.com/emails"
    assert b"https://datalens.example/reset-password?token=secret-token" in request.data


@requires_db
def test_signup_session_reset_and_file_isolation(tmp_path: Path) -> None:
    assert TEST_URI is not None
    db_name = f"datalens_auth_test_{ObjectId()}"
    settings = make_settings(
        tmp_path,
        auth_required=True,
        auth_cookie_secure=False,
        auth_expose_reset_token=True,
    )
    settings.mongodb_uri = TEST_URI
    settings.mongodb_db_name = db_name
    try:
        with TestClient(create_app(settings)) as client:
            first = client.post(
                "/api/v1/auth/signup",
                json={
                    "email": "admin@example.com",
                    "displayName": "관리자",
                    "password": "admin-password-123",
                },
            )
            assert first.status_code == 201
            assert first.json()["data"]["user"]["role"] == "admin"
            assert client.get("/api/v1/auth/session").status_code == 200

            uploaded = client.post(
                "/api/v1/files",
                files={"file": ("first.csv", b"name\nAlice\n", "text/csv")},
            )
            assert uploaded.status_code == 201
            assert client.post("/api/v1/auth/logout").status_code == 200

            second = client.post(
                "/api/v1/auth/signup",
                json={
                    "email": "user@example.com",
                    "displayName": "일반 사용자",
                    "password": "user-password-123",
                },
            )
            assert second.status_code == 201
            assert second.json()["data"]["user"]["role"] == "user"
            assert client.get("/api/v1/files").json()["data"]["total"] == 0
            forbidden = client.post(
                "/api/v1/complaints/categories/merge",
                json={"sourceCategoryId": "CAT-0001", "targetCategoryId": "CAT-0002"},
            )
            assert (forbidden.status_code, forbidden.json()["error"]["code"]) == (
                403,
                "ADMIN_REQUIRED",
            )

            reset = client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": "user@example.com"},
            )
            token = reset.json()["data"]["resetToken"]
            assert isinstance(token, str)
            confirmed = client.post(
                "/api/v1/auth/password-reset/confirm",
                json={"token": token, "password": "changed-password-123"},
            )
            assert confirmed.status_code == 200
            assert client.get("/api/v1/auth/session").status_code == 401

            logged_in = client.post(
                "/api/v1/auth/login",
                json={"email": "admin@example.com", "password": "admin-password-123"},
            )
            assert logged_in.status_code == 200
            assert client.get("/api/v1/files").json()["data"]["total"] == 1

        with MongoClient[Document](TEST_URI) as mongo:
            user = mongo[db_name]["users"].find_one({"email": "admin@example.com"})
            assert user is not None
            assert str(user["passwordHash"]).startswith("$argon2id$")
            assert "password" not in user
    finally:
        with MongoClient[Document](TEST_URI) as mongo:
            mongo.drop_database(db_name)
