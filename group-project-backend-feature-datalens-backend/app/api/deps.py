from typing import Annotated

from bson import ObjectId
from fastapi import Depends, Request

from app.core.config import Settings
from app.core.database import Mongo, get_mongo
from app.core.errors import AppError
from app.repositories.candidates import CandidateRepository
from app.repositories.categories import CategoryRepository
from app.repositories.complaints import ComplaintRepository
from app.repositories.files import FileRepository
from app.repositories.jobs import JobRepository
from app.repositories.results import ResultRepository
from app.repositories.reviews import ReviewRepository
from app.schemas.user import UserDocument
from app.services.cleaning_service import CleaningService
from app.services.complaint_service import ComplaintService
from app.services.dashboard_service import DashboardService
from app.services.dataset_service import DatasetService
from app.services.file_service import FileService
from app.services.job_service import JobService
from app.services.report_service import ReportService
from app.services.storage import create_storage


def get_app_settings(request: Request) -> Settings:
    """create_app에 넘긴 설정을 돌려준다.

    파라미터:
        request: 현재 요청(앱 상태에서 설정을 꺼낸다)
    """
    settings = request.app.state.settings
    # app.state는 타입 정보가 없으므로 mypy와 잘못된 등록을 함께 잡기 위해 확인한다
    assert isinstance(settings, Settings)
    return settings


def get_owner_id(
    request: Request,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ObjectId | None:
    """인증된 사용자의 소유자 ID를 반환한다. 인증이 꺼진 로컬 모드는 None이다.

    파라미터:
        request: 인증 미들웨어가 사용자를 넣은 현재 요청
        settings: 앱 인증 설정
    """
    if not settings.auth_required:
        return None
    user = getattr(request.state, "current_user", None)
    if not isinstance(user, UserDocument):
        raise AppError("AUTH_REQUIRED", "로그인이 필요합니다.", 401)
    return user.id


OwnerId = Annotated[ObjectId | None, Depends(get_owner_id)]


def get_file_service(
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    owner_id: OwnerId,
) -> FileService:
    """요청마다 파일 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
        settings: 앱 설정
    """
    # 저장소·서비스는 가벼운 래퍼라 요청마다 새로 만들고, 비싼 DB 연결만 Mongo로 공유한다.
    # 민원·검토 저장소는 파일 삭제 시 관련 민원 데이터까지 지우기 위해 넘긴다
    return FileService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ResultRepository(mongo.db, owner_id),
        create_storage(settings.storage_provider, settings.storage_root),
        settings,
        ComplaintRepository(mongo.db, owner_id),
        ReviewRepository(mongo.db, owner_id),
    )


def get_job_service(mongo: Annotated[Mongo, Depends(get_mongo)], owner_id: OwnerId) -> JobService:
    """요청마다 작업 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
    """
    return JobService(JobRepository(mongo.db, owner_id))


def get_dashboard_service(
    mongo: Annotated[Mongo, Depends(get_mongo)], owner_id: OwnerId
) -> DashboardService:
    """요청마다 전체 통계 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
    """
    # 대시보드는 읽기 전용 집계라 저장소(파일 쓰기)가 필요 없다
    return DashboardService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ResultRepository(mongo.db, owner_id),
    )


def get_cleaning_service(
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    owner_id: OwnerId,
) -> CleaningService:
    """요청마다 정제 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
        settings: 앱 설정
    """
    return CleaningService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ResultRepository(mongo.db, owner_id),
        create_storage(settings.storage_provider, settings.storage_root),
        settings,
    )


def get_report_service(
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    owner_id: OwnerId,
) -> ReportService:
    """요청마다 리포트 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
        settings: 앱 설정
    """
    # 리포트는 원본 파일을 다시 읽지 않고 저장된 결과만 쓰므로 저장소 없이 만든다.
    # LLM 설정(Azure 배포 이름 등)은 settings로 넘긴다
    return ReportService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ResultRepository(mongo.db, owner_id),
        settings,
    )


def get_dataset_service(
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    owner_id: OwnerId,
) -> DatasetService:
    """요청마다 통합 데이터셋 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
        settings: 앱 설정
    """
    return DatasetService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ResultRepository(mongo.db, owner_id),
        create_storage(settings.storage_provider, settings.storage_root),
        settings,
    )


def get_complaint_service(
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    owner_id: OwnerId,
) -> ComplaintService:
    """요청마다 민원 분석 서비스를 만든다.

    파라미터:
        mongo: Mongo 인스턴스
        settings: 앱 설정
    """
    return ComplaintService(
        FileRepository(mongo.db, owner_id),
        JobRepository(mongo.db, owner_id),
        ComplaintRepository(mongo.db, owner_id),
        CategoryRepository(mongo.db),
        CandidateRepository(mongo.db, owner_id),
        ReviewRepository(mongo.db, owner_id),
        create_storage(settings.storage_provider, settings.storage_root),
        settings,
    )
