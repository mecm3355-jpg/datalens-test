from datetime import datetime
from typing import Literal

from bson import ObjectId
from pydantic import Field

from app.schemas.mongo import MongoDocument, utc_now

UserRole = Literal["admin", "user"]


class UserDocument(MongoDocument):
    """users 컬렉션의 계정 문서. 비밀번호 원문은 저장하지 않는다."""

    email: str
    display_name: str
    password_hash: str
    role: UserRole = "user"
    is_active: bool = True
    failed_login_attempts: int = Field(default=0, ge=0)
    locked_until: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SessionDocument(MongoDocument):
    """sessions 컬렉션의 서버 세션. 쿠키 토큰은 SHA-256 해시만 저장한다."""

    user_id: ObjectId
    token_hash: str
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime


class PasswordResetDocument(MongoDocument):
    """password_resets 컬렉션의 일회용 비밀번호 재설정 토큰."""

    user_id: ObjectId
    token_hash: str
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    used_at: datetime | None = None
