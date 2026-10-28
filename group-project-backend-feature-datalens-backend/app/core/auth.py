"""MongoDB 계정 인증에 사용하는 비밀번호·세션 토큰 도구."""

import hashlib
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

COOKIE_NAME = "datalens_session"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)
# 존재하지 않는 계정도 실제 해시 검증을 수행해 이메일 존재 여부의 시간 차이를 줄인다.
_DUMMY_PASSWORD_HASH = _PASSWORD_HASHER.hash("DataLens-dummy-password-2026")


def normalize_email(email: str) -> str:
    """이메일을 조회·중복 검사에 사용할 형태로 정규화한다.

    파라미터:
        email: 사용자가 입력한 이메일
    """
    return email.strip().lower()


def valid_email(email: str) -> bool:
    """기본 이메일 형식을 확인한다.

    파라미터:
        email: 정규화된 이메일
    """
    return EMAIL_PATTERN.fullmatch(email) is not None and len(email) <= 254


def validate_password(password: str) -> str | None:
    """비밀번호 정책 오류 메시지를 반환한다. 유효하면 None이다.

    파라미터:
        password: 검사할 비밀번호 원문
    """
    if len(password) < 10:
        return "비밀번호는 10자 이상이어야 합니다."
    if len(password) > 128:
        return "비밀번호는 128자 이하여야 합니다."
    if not any(character.isalpha() for character in password):
        return "비밀번호에 영문 또는 한글을 포함해 주세요."
    if not any(character.isdigit() for character in password):
        return "비밀번호에 숫자를 포함해 주세요."
    return None


def hash_password(password: str) -> str:
    """비밀번호를 Argon2id로 해시한다.

    파라미터:
        password: 정책 검사를 통과한 비밀번호 원문
    """
    return _PASSWORD_HASHER.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Argon2id 해시와 입력 비밀번호가 일치하는지 확인한다.

    파라미터:
        password_hash: 저장된 Argon2id 해시
        password: 사용자가 입력한 비밀번호
    """
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_dummy_password(password: str) -> None:
    """존재하지 않는 계정에도 실제 해시 검증 비용을 적용한다.

    파라미터:
        password: 사용자가 입력한 비밀번호
    """
    verify_password(_DUMMY_PASSWORD_HASH, password)


def new_opaque_token() -> str:
    """세션·재설정에 사용할 예측 불가능한 URL-safe 토큰을 만든다.

    파라미터: 없음
    """
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """원문 토큰을 저장하지 않도록 SHA-256 해시로 바꾼다.

    파라미터:
        token: 쿠키 또는 재설정 링크에서 받은 원문 토큰
    """
    return hashlib.sha256(token.encode()).hexdigest()
