from datetime import datetime

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import Document
from app.repositories.base import BaseRepository
from app.schemas.mongo import utc_now
from app.schemas.user import PasswordResetDocument, SessionDocument, UserDocument


class UserRepository(BaseRepository[UserDocument]):
    """사용자 계정 저장소."""

    COLLECTION = "users"
    INDEXES = [
        IndexModel([("email", ASCENDING)], name="email_unique", unique=True),
        IndexModel([("role", ASCENDING), ("createdAt", ASCENDING)], name="role_createdAt"),
    ]

    def __init__(self, db: AsyncDatabase[Document]) -> None:
        """사용자 저장소를 만든다.

        파라미터:
            db: 사용할 MongoDB 데이터베이스
        """
        super().__init__(db, UserDocument)

    async def find_by_email(self, email: str) -> UserDocument | None:
        """정규화된 이메일로 사용자를 찾는다.

        파라미터:
            email: 소문자로 정규화된 이메일
        """
        raw = await self.collection.find_one({"email": email})
        return None if raw is None else UserDocument.model_validate(raw)

    async def record_login_failure(
        self, user_id: ObjectId, attempts: int, locked_until: datetime | None
    ) -> None:
        """로그인 실패 횟수와 잠금 만료 시각을 저장한다.

        파라미터:
            user_id: 실패한 사용자 ID
            attempts: 누적 실패 횟수
            locked_until: 잠금 만료 시각 또는 None
        """
        await self.collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "failedLoginAttempts": attempts,
                    "lockedUntil": locked_until,
                    "updatedAt": utc_now(),
                }
            },
        )

    async def clear_login_failures(self, user_id: ObjectId) -> None:
        """로그인 성공 후 실패 횟수와 잠금을 초기화한다.

        파라미터:
            user_id: 로그인한 사용자 ID
        """
        await self.collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "failedLoginAttempts": 0,
                    "lockedUntil": None,
                    "updatedAt": utc_now(),
                }
            },
        )

    async def update_password(self, user_id: ObjectId, password_hash: str) -> None:
        """사용자의 비밀번호 해시를 교체한다.

        파라미터:
            user_id: 대상 사용자 ID
            password_hash: 새 Argon2id 해시
        """
        await self.collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "passwordHash": password_hash,
                    "failedLoginAttempts": 0,
                    "lockedUntil": None,
                    "updatedAt": utc_now(),
                }
            },
        )


class SessionRepository(BaseRepository[SessionDocument]):
    """서버 세션 저장소."""

    COLLECTION = "sessions"
    INDEXES = [
        IndexModel([("tokenHash", ASCENDING)], name="tokenHash_unique", unique=True),
        IndexModel([("userId", ASCENDING), ("createdAt", DESCENDING)], name="userId_createdAt"),
        IndexModel([("expiresAt", ASCENDING)], name="expiresAt_ttl", expireAfterSeconds=0),
    ]

    def __init__(self, db: AsyncDatabase[Document]) -> None:
        """세션 저장소를 만든다.

        파라미터:
            db: 사용할 MongoDB 데이터베이스
        """
        super().__init__(db, SessionDocument)

    async def find_valid(self, token_hash: str, now: datetime) -> SessionDocument | None:
        """해시가 일치하고 아직 만료되지 않은 세션을 찾는다.

        파라미터:
            token_hash: 쿠키 토큰의 SHA-256 해시
            now: 비교할 현재 UTC 시각
        """
        raw = await self.collection.find_one({"tokenHash": token_hash, "expiresAt": {"$gt": now}})
        return None if raw is None else SessionDocument.model_validate(raw)

    async def delete_by_token(self, token_hash: str) -> bool:
        """토큰 해시가 일치하는 세션을 삭제한다.

        파라미터:
            token_hash: 쿠키 토큰의 SHA-256 해시
        """
        result = await self.collection.delete_one({"tokenHash": token_hash})
        return result.deleted_count == 1

    async def delete_by_user(self, user_id: ObjectId) -> int:
        """사용자의 모든 세션을 삭제한다.

        파라미터:
            user_id: 대상 사용자 ID
        """
        result = await self.collection.delete_many({"userId": user_id})
        return result.deleted_count


class PasswordResetRepository(BaseRepository[PasswordResetDocument]):
    """일회용 비밀번호 재설정 토큰 저장소."""

    COLLECTION = "password_resets"
    INDEXES = [
        IndexModel([("tokenHash", ASCENDING)], name="tokenHash_unique", unique=True),
        IndexModel([("expiresAt", ASCENDING)], name="expiresAt_ttl", expireAfterSeconds=0),
    ]

    def __init__(self, db: AsyncDatabase[Document]) -> None:
        """재설정 토큰 저장소를 만든다.

        파라미터:
            db: 사용할 MongoDB 데이터베이스
        """
        super().__init__(db, PasswordResetDocument)

    async def consume(self, token_hash: str, now: datetime) -> PasswordResetDocument | None:
        """유효한 토큰을 원자적으로 사용 처리하고 반환한다.

        파라미터:
            token_hash: 입력 토큰의 SHA-256 해시
            now: 비교할 현재 UTC 시각
        """
        raw = await self.collection.find_one_and_update(
            {"tokenHash": token_hash, "expiresAt": {"$gt": now}, "usedAt": None},
            {"$set": {"usedAt": now}},
            return_document=ReturnDocument.AFTER,
        )
        return None if raw is None else PasswordResetDocument.model_validate(raw)

    async def delete_by_user(self, user_id: ObjectId) -> int:
        """사용자의 기존 재설정 토큰을 모두 삭제한다.

        파라미터:
            user_id: 대상 사용자 ID
        """
        result = await self.collection.delete_many({"userId": user_id})
        return result.deleted_count
