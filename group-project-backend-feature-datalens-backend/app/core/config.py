from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경 변수(.env)에서 읽는 애플리케이션 설정. 비밀 값은 코드에 두지 않는다."""

    # extra=ignore: .env에 다른 도구용 변수(MONGODB_TEST_URI 등)가 있어도 시작을 막지 않는다
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DataLens"
    # 연결 문자열은 비밀 값이라 기본값 없이 필수로 둔다(없으면 시작할 때 바로 실패)
    mongodb_uri: str
    mongodb_db_name: str = "datalens"

    # MongoDB 사용자 인증. AUTH_REQUIRED=true면 보호 API에 서버 세션 쿠키를 요구한다.
    auth_required: bool = False
    # 이전 공용 운영자 로그인 환경 변수와의 배포 호환을 위해 읽기만 한다.
    auth_session_seconds: int = 8 * 60 * 60
    auth_cookie_secure: bool = True
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_registration_enabled: bool = True
    auth_max_failed_attempts: int = 5
    auth_lockout_seconds: int = 15 * 60
    auth_password_reset_seconds: int = 30 * 60
    # 이메일 발송 연동 전 로컬 데모에서만 재설정 토큰을 응답에 포함한다.
    auth_expose_reset_token: bool = False
    # 운영 비밀번호 재설정 메일(Resend HTTP API). 키·발신자·프런트 URL이 모두 있어야 활성화된다.
    resend_api_key: SecretStr | None = None
    password_reset_from: str | None = None
    frontend_url: str = "http://localhost:5173"

    # 독립 배포된 Vite 프런트엔드가 API를 호출할 수 있는 출처 목록.
    # 쉼표로 구분해 Vercel 운영 도메인과 로컬 개발 주소를 함께 지정한다.
    cors_origins: str = "http://localhost:5173"

    # 원본 파일·산출물 로컬 저장소 루트(files.storage.provider = local)
    storage_provider: Literal["local", "vercel_blob"] = "local"
    storage_root: Path = Path("storage")
    # 업로드 제한(PRD 10장). 압축 기반 형식(XLSX·DOCX)은 풀었을 때 크기·파일 수도 제한
    # 100MB. 압축 해제 1GB·항목 1만 개 제한은 압축 폭탄(zip bomb) 방어용
    max_upload_bytes: int = 100 * 1024 * 1024
    max_zip_uncompressed_bytes: int = 1024 * 1024 * 1024
    max_zip_entries: int = 10_000
    max_pdf_pages: int = 500

    # 워커(python -m app.worker): 대기 작업이 없을 때 다시 확인하는 간격,
    # 이 시간보다 오래 processing에 머문 작업은 워커가 멈춘 것으로 보고 실패 처리
    worker_poll_seconds: float = 1.0
    job_timeout_seconds: int = 60 * 60
    # local은 별도 polling worker, vercel_queue는 작업 생성 즉시 Vercel Queue로 발행한다.
    job_dispatch_mode: Literal["local", "vercel_queue"] = "local"
    # 비공개 Queue worker 서비스가 내부 작업 실행 API를 호출할 때 검증하는 공유 비밀.
    queue_worker_secret: SecretStr | None = None

    # Azure OpenAI(PRD 6.1). 값은 .env에만 둔다.
    # 엔드포인트가 .../openai/v1 이면 v1 API(API 버전 불필요), 아니면 API 버전이 필요하다.
    # 배포 이름(모델명 아님): FAST는 대량·정형 작업(속성 추출 등), DEEP은 깊은 추론(리포트 등)
    azure_openai_endpoint: str | None = None
    # SecretStr: 로그나 repr에 키가 그대로 찍히지 않게 한다. 비우면 LLM 없이 규칙 방식으로 동작
    azure_openai_api_key: SecretStr | None = None
    azure_openai_api_version: str | None = None
    azure_openai_deployment_fast: str | None = None
    azure_openai_deployment_deep: str | None = None
    llm_timeout_seconds: float = 120.0

    # OCR(PRD 7.6): 로컬 Tesseract. 경로를 비우면 PATH와 Windows 기본 설치 위치에서 찾는다.
    # 한국어 모델(kor.traineddata)이 기본 폴더에 없으면 TESSERACT_TESSDATA_DIR로 지정한다
    tesseract_cmd: str | None = None
    tesseract_tessdata_dir: Path | None = None
    ocr_languages: str = "kor"
    # 300dpi: Tesseract 권장 해상도. 더 낮으면 한글 획이 뭉개져 정확도가 떨어진다
    ocr_dpi: int = 300
    # 줄 신뢰도가 이 값 미만이면 사람 검수 대상
    ocr_low_confidence: float = 0.6

    # 민원 분석 임베딩(PRD 6장, 로컬). 기본은 AI 모델 없는 단어 벡터이고, 모델 이름을 주면 그 모델을
    # 쓴다. 모델을 쓸 때 캐시 폴더를 비우면 저장소의 embedding-cache를 쓴다
    embedding_model: str = "term-hash-v1"
    embedding_cache_dir: Path | None = None

    @model_validator(mode="after")
    def validate_auth_configuration(self) -> Self:
        """인증 관련 횟수와 만료 시간이 안전한 범위인지 확인한다."""
        if self.auth_session_seconds < 300:
            raise ValueError("AUTH_SESSION_SECONDS는 300초 이상이어야 합니다.")
        if not 3 <= self.auth_max_failed_attempts <= 20:
            raise ValueError("AUTH_MAX_FAILED_ATTEMPTS는 3~20이어야 합니다.")
        if self.auth_lockout_seconds < 60:
            raise ValueError("AUTH_LOCKOUT_SECONDS는 60초 이상이어야 합니다.")
        if self.auth_password_reset_seconds < 300:
            raise ValueError("AUTH_PASSWORD_RESET_SECONDS는 300초 이상이어야 합니다.")
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SAMESITE=none이면 AUTH_COOKIE_SECURE=true여야 합니다.")
        return self

    def password_reset_delivery_configured(self) -> bool:
        """운영 비밀번호 재설정 메일에 필요한 설정이 모두 있는지 확인한다."""
        return bool(self.resend_api_key and self.password_reset_from and self.frontend_url)

    def allowed_cors_origins(self) -> list[str]:
        """쉼표로 구분한 CORS_ORIGINS를 빈 값 없이 정리한다.

        파라미터: 없음
        """
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# 요청마다 .env를 다시 읽지 않도록 캐시한다. 테스트는 create_app에 설정을 직접 넘긴다
@lru_cache
def get_settings() -> Settings:
    """설정 객체를 한 번만 만들어 재사용한다.

    파라미터: 없음. 값은 환경 변수와 .env 파일에서 읽는다.
    """
    return Settings()
