from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.auth import (
    hash_password,
    hash_token,
    new_opaque_token,
    normalize_email,
    valid_email,
    validate_password,
    verify_dummy_password,
    verify_password,
)
from app.core.config import Settings
from app.core.database import Document
from app.core.errors import AppError
from app.repositories.users import PasswordResetRepository, SessionRepository, UserRepository
from app.schemas.mongo import utc_now
from app.schemas.user import PasswordResetDocument, SessionDocument, UserDocument


class AuthService:
    """회원가입, 로그인, 서버 세션과 비밀번호 재설정을 처리한다."""

    def __init__(self, db: AsyncDatabase[Document], settings: Settings) -> None:
        """인증 서비스를 만든다.

        파라미터:
            db: 사용할 MongoDB 데이터베이스
            settings: 인증 만료·잠금 설정
        """
        self._db = db
        self._settings = settings
        self._users = UserRepository(db)
        self._sessions = SessionRepository(db)
        self._resets = PasswordResetRepository(db)

    async def signup(self, email: str, display_name: str, password: str) -> UserDocument:
        """새 계정을 만들고 첫 계정이면 관리자와 기존 데이터 소유자로 지정한다.

        파라미터:
            email: 로그인 이메일
            display_name: 화면에 표시할 이름
            password: 비밀번호 원문
        """
        if not self._settings.auth_registration_enabled:
            raise AppError("REGISTRATION_DISABLED", "현재 회원가입을 받지 않습니다.", 403)
        normalized = normalize_email(email)
        if not valid_email(normalized):
            raise AppError("INVALID_EMAIL", "이메일 형식을 확인해 주세요.")
        name = display_name.strip()
        if len(name) < 2 or len(name) > 50:
            raise AppError("INVALID_DISPLAY_NAME", "이름은 2자 이상 50자 이하로 입력해 주세요.")
        password_error = validate_password(password)
        if password_error:
            raise AppError("WEAK_PASSWORD", password_error)
        user = UserDocument(
            email=normalized,
            display_name=name,
            password_hash=hash_password(password),
        )
        try:
            await self._users.insert(user)
        except DuplicateKeyError as error:
            raise AppError("EMAIL_ALREADY_REGISTERED", "이미 가입된 이메일입니다.", 409) from error
        if await self._claim_first_admin(user.id):
            user = user.model_copy(update={"role": "admin"})
            await self._users.collection.update_one(
                {"_id": user.id}, {"$set": {"role": "admin", "updatedAt": utc_now()}}
            )
            await self._claim_legacy_data(user.id)
        return user

    async def _claim_first_admin(self, user_id: ObjectId) -> bool:
        """첫 가입자만 auth_state의 관리자 자리를 원자적으로 차지하게 한다.

        파라미터:
            user_id: 가입한 사용자 ID
        """
        try:
            result = await self._db["auth_state"].update_one(
                {"_id": "bootstrap", "adminUserId": {"$exists": False}},
                {"$set": {"adminUserId": user_id, "createdAt": utc_now()}},
                upsert=True,
            )
            return result.upserted_id is not None or result.modified_count == 1
        except DuplicateKeyError:
            return False

    async def _claim_legacy_data(self, user_id: ObjectId) -> None:
        """기존 소유자 없는 업무 데이터를 최초 관리자에게 귀속한다.

        파라미터:
            user_id: 최초 관리자 ID
        """
        for collection_name in (
            "files",
            "processing_jobs",
            "processing_results",
            "complaints",
            "category_candidates",
            "reviews",
            "issues",
        ):
            await self._db[collection_name].update_many(
                {"ownerId": {"$exists": False}}, {"$set": {"ownerId": user_id}}
            )

    async def login(self, email: str, password: str) -> tuple[UserDocument, str]:
        """자격 증명을 확인하고 새 서버 세션 토큰을 발급한다.

        파라미터:
            email: 로그인 이메일
            password: 비밀번호 원문
        """
        now = utc_now()
        user = await self._users.find_by_email(normalize_email(email))
        if user is None:
            verify_dummy_password(password)
            raise AppError("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", 401)
        if not user.is_active:
            raise AppError("ACCOUNT_DISABLED", "사용할 수 없는 계정입니다.", 403)
        if user.locked_until is not None and user.locked_until > now:
            raise AppError(
                "ACCOUNT_LOCKED",
                "로그인 시도가 반복되어 계정이 잠겼습니다. 잠시 후 다시 시도해 주세요.",
                429,
            )
        if not verify_password(user.password_hash, password):
            attempts = user.failed_login_attempts + 1
            locked_until = None
            if attempts >= self._settings.auth_max_failed_attempts:
                locked_until = now + timedelta(seconds=self._settings.auth_lockout_seconds)
                attempts = 0
            await self._users.record_login_failure(user.id, attempts, locked_until)
            raise AppError("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", 401)
        await self._users.clear_login_failures(user.id)
        token = new_opaque_token()
        await self._sessions.insert(
            SessionDocument(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=now + timedelta(seconds=self._settings.auth_session_seconds),
            )
        )
        return user, token

    async def authenticate(self, token: str | None) -> UserDocument | None:
        """쿠키 토큰에 연결된 활성 사용자를 반환한다.

        파라미터:
            token: 요청 쿠키의 원문 세션 토큰
        """
        if not token:
            return None
        session = await self._sessions.find_valid(hash_token(token), utc_now())
        if session is None:
            return None
        user = await self._users.get(session.user_id)
        return user if user is not None and user.is_active else None

    async def logout(self, token: str | None) -> None:
        """현재 세션을 DB에서 삭제한다.

        파라미터:
            token: 요청 쿠키의 원문 세션 토큰
        """
        if token:
            await self._sessions.delete_by_token(hash_token(token))

    async def request_password_reset(self, email: str) -> str | None:
        """일회용 재설정 토큰을 만들며, 계정이 없으면 동일하게 성공 처리한다.

        파라미터:
            email: 가입 이메일
        """
        user = await self._users.find_by_email(normalize_email(email))
        if user is None or not user.is_active:
            return None
        await self._resets.delete_by_user(user.id)
        token = new_opaque_token()
        await self._resets.insert(
            PasswordResetDocument(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=utc_now()
                + timedelta(seconds=self._settings.auth_password_reset_seconds),
            )
        )
        return token

    async def reset_password(self, token: str, password: str) -> None:
        """유효한 일회용 토큰으로 비밀번호를 바꾸고 모든 세션을 종료한다.

        파라미터:
            token: 재설정 링크의 원문 토큰
            password: 새 비밀번호 원문
        """
        password_error = validate_password(password)
        if password_error:
            raise AppError("WEAK_PASSWORD", password_error)
        reset = await self._resets.consume(hash_token(token), utc_now())
        if reset is None:
            raise AppError("INVALID_RESET_TOKEN", "재설정 링크가 만료되었거나 이미 사용되었습니다.")
        await self._users.update_password(reset.user_id, hash_password(password))
        await self._sessions.delete_by_user(reset.user_id)
